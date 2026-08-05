import path from 'node:path';
import type {
  BuildContext,
  HttpMethod,
  ModelDefinition,
  OperationDefinition,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
  TypeTarget,
} from '../types.js';
import { refsInSchema, stableOperationName } from '../build-context.js';
import {
  posixRelativeImport,
  refName,
  safeFileBase,
  toCamelCase,
  toPascalCase,
  uniqueSorted,
} from '../utils/names.js';
import { commentText, jsDoc } from '../utils/comments.js';
import { generatedHeader } from '../utils/metadata.js';
import type { GeneratedFile } from './model-generator.js';
import { modelFilePath } from '../build-context.js';

export function generateApiFiles(context: BuildContext): GeneratedFile[] {
  const groups = new Map<string, OperationDefinition[]>();
  for (const operation of context.operations) {
    const key = apiFileNoExt(operation.target);
    const operations = groups.get(key) ?? [];
    operations.push(operation);
    groups.set(key, operations);
  }

  return Array.from(groups.entries()).map(([fileNoExt, operations]) =>
    generateApiFile(fileNoExt, operations, context),
  );
}

function generateApiFile(
  fileNoExt: string,
  operations: OperationDefinition[],
  context: BuildContext,
): GeneratedFile {
  const fromDir = path.posix.dirname(fileNoExt);
  const imports = collectApiImports(fileNoExt, operations, context);
  const className = apiClassName(operations);
  const methods = operations
    .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`))
    .map((operation) => renderOperation(operation, context))
    .join('\n\n');

  const baseImport = posixRelativeImport(fromDir, 'base');
  return {
    filePath: `${fileNoExt}.ts`,
    content: [
      header(),
      `import { BaseAPI, type RequestArgs } from '${baseImport}';`,
      imports,
      `export class ${className} extends BaseAPI {\n${methods}\n}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

function collectApiImports(
  fileNoExt: string,
  operations: OperationDefinition[],
  context: BuildContext,
): string {
  const importsByPath = new Map<string, Set<string>>();
  const fromDir = path.posix.dirname(fileNoExt);
  const addImport = (model: ModelDefinition): void => {
    const importPath = posixRelativeImport(fromDir, modelFilePath(model.target));
    const names = importsByPath.get(importPath) ?? new Set<string>();
    names.add(model.typeName);
    importsByPath.set(importPath, names);
  };
  const collect = (schema: SchemaObject | undefined): void => {
    for (const schemaRef of refsInSchema(schema)) {
      const model = context.modelBySchema.get(schemaRef);
      if (model) addImport(model);
    }
    const visitInlineEnum = (node: SchemaObject | undefined): void => {
      if (!node) return;
      if (node.enum?.length) {
        const enumModel = findEnumModel(node, context);
        if (enumModel) addImport(enumModel);
      }
      visitInlineEnum(node.items);
      if (typeof node.additionalProperties === 'object') visitInlineEnum(node.additionalProperties);
      for (const child of Object.values(node.properties ?? {})) visitInlineEnum(child);
      for (const child of [...(node.allOf ?? []), ...(node.oneOf ?? []), ...(node.anyOf ?? [])]) visitInlineEnum(child);
    };
    visitInlineEnum(schema);
  };

  for (const operation of operations) {
    for (const parameter of operation.operation.parameters ?? []) {
      collect(parameter.schema ?? parameterToSchema(parameter));
    }
    collect(requestBodySchema(operation.operation.requestBody));
    collect(successResponseSchema(operation.operation.responses));
  }

  return Array.from(importsByPath.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([importPath, names]) => `import type { ${uniqueSorted(names).join(', ')} } from '${importPath}';`)
    .join('\n');
}

function renderOperation(operationDef: OperationDefinition, context: BuildContext): string {
  const operation = operationDef.operation;
  const methodName = stableOperationName(operationDef.method, operationDef.path, operation.operationId);
  const params = operation.parameters ?? [];
  const body = bodyParameter(params, operation.requestBody, context);
  const pathParams = params.filter((param) => param.in === 'path');
  const queryParams = params.filter((param) => param.in === 'query');
  const headerParams = params.filter((param) => param.in === 'header');
  const methodParams = [
    ...pathParams.map((param) => renderMethodParam(param, context)),
    ...queryParams.map((param) => renderMethodParam(param, context)),
    ...headerParams.map((param) => renderMethodParam(param, context)),
    ...(body ? [body] : []),
  ].sort((a, b) => Number(isOptionalParam(a)) - Number(isOptionalParam(b)));
  methodParams.push('options: RequestArgs = {}');
  const returnType = schemaToType(successResponseSchema(operation.responses), context);
  const urlExpr = renderUrl(operationDef.path, pathParams);
  const queryExpr = renderObjectLiteral(queryParams);
  const headerExpr = renderObjectLiteral(headerParams);
  const bodyVariable = body?.match(/^[A-Za-z_$][A-Za-z0-9_$]*/)?.[0];
  const dataLine = bodyVariable ? `      data: ${bodyVariable},` : '';
  const doc = renderOperationDoc(operationDef, params, bodyVariable);

  return `${doc ? `${doc}\n` : ''}  async ${methodName}(${methodParams.join(', ')}): Promise<${returnType}> {
    const response = await this.request<${returnType}>({
      ...options,
      method: '${operationDef.method.toUpperCase()}',
      url: ${urlExpr},
      params: ${queryExpr},
      headers: { ...(options.headers ?? {}), ...${headerExpr} },
${dataLine}
    });
    return response;
  }`;
}

function renderOperationDoc(
  operationDef: OperationDefinition,
  parameters: ParameterObject[],
  bodyVariable: string | undefined,
): string {
  const operation = operationDef.operation;
  const lines: string[] = [];

  const description = commentText(operation);
  if (description && description !== operation.summary) lines.push(description);
  if (operation.summary) lines.push(`@summary ${operation.summary}`);

  for (const parameter of parameters.filter((param) => param.in !== 'body')) {
    const descriptionText = commentText(parameter);
    lines.push(`@param ${paramVar(parameter.name)}${descriptionText ? ` ${descriptionText}` : ''}`);
  }

  const bodyParameter = parameters.find((parameter) => parameter.in === 'body');
  if (bodyVariable) {
    const descriptionText = commentText(bodyParameter ?? operation.requestBody);
    lines.push(`@param ${bodyVariable}${descriptionText ? ` ${descriptionText}` : ''}`);
  }

  lines.push('@param options Override http request option.');
  return jsDoc(lines, '  ');
}

function renderMethodParam(parameter: ParameterObject, context: BuildContext): string {
  const optional = parameter.required ? '' : '?';
  return `${paramVar(parameter.name)}${optional}: ${schemaToType(parameter.schema ?? parameterToSchema(parameter), context)}`;
}

function bodyParameter(
  parameters: ParameterObject[],
  requestBody: RequestBodyObject | undefined,
  context: BuildContext,
): string | undefined {
  const body = parameters.find((parameter) => parameter.in === 'body');
  if (body) {
    return `${paramVar(body.name || 'body')}${body.required ? '' : '?'}: ${schemaToType(body.schema, context)}`;
  }
  const schema = requestBodySchema(requestBody);
  if (!schema) return undefined;
  return `body${requestBody?.required ? '' : '?'}: ${schemaToType(schema, context)}`;
}

function renderUrl(urlPath: string, pathParams: ParameterObject[]): string {
  let template = urlPath;
  for (const param of pathParams) {
    const variable = paramVar(param.name);
    template = template.replace(
      new RegExp(`\\{${escapeRegExp(param.name)}\\}`, 'g'),
      `\${encodeURIComponent(String(${variable}))}`,
    );
  }
  return `\`${template}\``;
}

function renderObjectLiteral(parameters: ParameterObject[]): string {
  const entries = parameters.map((param) => `${JSON.stringify(param.name)}: ${paramVar(param.name)}`);
  return `{ ${entries.join(', ')} }`;
}

function paramVar(name: string): string {
  return toCamelCase(name);
}

function isOptionalParam(param: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*\?/.test(param);
}

function requestBodySchema(requestBody: RequestBodyObject | undefined): SchemaObject | undefined {
  if (!requestBody?.content) return undefined;
  return (
    requestBody.content['application/json']?.schema ??
    requestBody.content['*/*']?.schema ??
    Object.values(requestBody.content)[0]?.schema
  );
}

function parameterToSchema(parameter: ParameterObject): SchemaObject {
  return {
    type: parameter.type,
    format: parameter.format,
    items: parameter.items,
    enum: parameter.enum,
  };
}

function successResponseSchema(responses: Record<string, { schema?: SchemaObject; content?: Record<string, { schema?: SchemaObject }> }> | undefined): SchemaObject | undefined {
  if (!responses) return undefined;
  const key = Object.keys(responses).find((status) => /^2\d\d$/.test(status)) ?? '200';
  const response = responses[key] ?? responses.default;
  return response?.schema ?? response?.content?.['application/json']?.schema ?? Object.values(response?.content ?? {})[0]?.schema;
}

function normalizeEnumValues(values: Array<string | number | boolean | null> | undefined): string {
  return [...(values ?? [])].map((v) => String(v)).sort().join('|');
}

function findEnumModel(schema: SchemaObject, context: BuildContext): ModelDefinition | undefined {
  if (!schema.enum?.length) return undefined;
  const key = normalizeEnumValues(schema.enum);
  for (const model of context.models) {
    if (model.schema.enum?.length && normalizeEnumValues(model.schema.enum) === key) {
      return model;
    }
  }
  return undefined;
}

function schemaToType(schema: SchemaObject | undefined, context: BuildContext): string {
  if (!schema) return 'void';
  if (schema.$ref) return context.modelBySchema.get(refName(schema.$ref))?.typeName ?? 'unknown';
  if (schema.type === 'array') return `Array<${schemaToType(schema.items, context)}>`;
  if (schema.enum?.length) {
    const enumModel = findEnumModel(schema, context);
    if (enumModel) return enumModel.typeName;
    return schema.enum.map((value) => JSON.stringify(String(value))).join(' | ');
  }
  if (schema.type === 'object') return 'Record<string, unknown>';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'string') return 'string';
  return 'unknown';
}

function apiFileNoExt(target: TypeTarget): string {
  return ['apis', ...target.modulePath, safeFileBase(target.fileBase)].join('/');
}

function apiClassName(operations: OperationDefinition[]): string {
  const tag = operations.find((operation) => operation.operation.tags?.[0])?.operation.tags?.[0];
  return toPascalCase(`${tag || path.posix.basename(apiFileNoExt(operations[0].target))}Api`);
}

function header(): string {
  return generatedHeader();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function apiIndexFiles(files: GeneratedFile[]): GeneratedFile[] {
  const dirs = new Map<string, Set<string>>();

  for (const file of files) {
    const parsed = path.posix.parse(file.filePath);
    const parts = parsed.dir.split('/').filter(Boolean);
    if (parts[0] !== 'apis') continue;
    const key = parts.join('/');
    const names = dirs.get(key) ?? new Set<string>();
    names.add(parsed.name);
    dirs.set(key, names);
  }

  const indexFiles: GeneratedFile[] = [];
  for (const [dir, names] of dirs.entries()) {
    indexFiles.push({
      filePath: `${dir}/index.ts`,
      content: uniqueSorted(names)
        .filter((name) => name !== 'index')
        .map((name) => `export * from './${name}';`)
        .join('\n'),
    });
  }

  return indexFiles;
}
