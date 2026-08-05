import type {
  BuildContext,
  GeneratorOptions,
  HttpMethod,
  LoadedDocument,
  ModelDefinition,
  OpenApiDocument,
  OperationDefinition,
  SchemaObject,
  TypeTarget,
} from './types.js';
import { refName, safeFileBase, toKebabCase, toPascalCase } from './utils/names.js';

const HTTP_METHODS = new Set<HttpMethod>([
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'head',
  'options',
]);

export function buildContext(docs: LoadedDocument[], options?: Pick<GeneratorOptions, 'methodStyle' | 'stripOperationPrefix'>): BuildContext {
  const warnings: string[] = [];
  const models: ModelDefinition[] = [];
  const modelBySchema = new Map<string, ModelDefinition>();
  const ownerBySchema = new Map<string, LoadedDocument>();

  // schema 名在合并后的 SDK 中必须唯一；重复 schema 保留第一次出现的定义
  for (const loaded of docs) {
    const schemas = collectSchemas(loaded.document);
    for (const [schemaName, schema] of Object.entries(schemas)) {
      if (!ownerBySchema.has(schemaName)) {
        ownerBySchema.set(schemaName, loaded);
        const model = createModel(schemaName, schema, loaded);
        models.push(model);
        modelBySchema.set(schemaName, model);
      }
    }
  }

  const operations: OperationDefinition[] = [];
  // API 以 Swagger tag 为生成文件维度，保持和常见 typescript-axios 输出习惯接近
  for (const loaded of docs) {
    for (const [urlPath, pathItem] of Object.entries(loaded.document.paths ?? {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        const normalizedMethod = method.toLowerCase() as HttpMethod;
        if (!HTTP_METHODS.has(normalizedMethod)) continue;
        operations.push({
          method: normalizedMethod,
          path: urlPath,
          operation,
          target: {
            modulePath: [],
            fileBase: apiFileBase(operation.tags?.[0]),
          },
        });
      }
    }
  }

  return {
    models,
    operations,
    modelBySchema,
    warnings,
    methodStyle: options?.methodStyle ?? 'positional',
    stripOperationPrefix: options?.stripOperationPrefix ?? false,
  };
}

function collectSchemas(document: OpenApiDocument): Record<string, SchemaObject> {
  return {
    ...(document.definitions ?? {}),
    ...(document.components?.schemas ?? {}),
  };
}

function createModel(
  schemaName: string,
  schema: SchemaObject,
  loaded: LoadedDocument,
): ModelDefinition {
  const typeName = toPascalCase(schemaName);
  const namespace = schemaNamespace(schemaName);

  return {
    schemaName,
    typeName,
    schema,
    target: modelTarget(namespace, loaded),
  };
}

export function refsInSchema(schema: SchemaObject | undefined): string[] {
  if (!schema) return [];
  const refs = new Set<string>();
  const visit = (node: SchemaObject | undefined): void => {
    if (!node) return;
    if (node.$ref) refs.add(refName(node.$ref));
    visit(node.items);
    if (typeof node.additionalProperties === 'object') visit(node.additionalProperties);
    for (const child of Object.values(node.properties ?? {})) visit(child);
    for (const child of [...(node.allOf ?? []), ...(node.oneOf ?? []), ...(node.anyOf ?? [])]) visit(child);
  };
  visit(schema);
  return Array.from(refs);
}

export function stableOperationName(method: HttpMethod, urlPath: string, operationId?: string): string {
  if (operationId) return toPascalCase(operationId).replace(/^./, (c) => c.toLowerCase());
  return toPascalCase(`${method}_${urlPath}`).replace(/^./, (c) => c.toLowerCase());
}

export function targetKey(target: TypeTarget): string {
  return [target.rootDir ?? 'models', ...target.modulePath, target.fileBase].join('/');
}

export function modelFilePath(target: TypeTarget): string {
  return [target.rootDir ?? 'models', ...target.modulePath, safeFileBase(target.fileBase)].join('/');
}

function apiFileBase(tag: string | undefined): string {
  return safeFileBase(`${tag || 'Default'}Api`);
}

function schemaNamespace(schemaName: string): string | undefined {
  const snakeMatch = schemaName.match(/^([a-z][a-z0-9_]+)[A-Z]/);
  if (snakeMatch) return toKebabCase(snakeMatch[1]);

  const camelMatch = schemaName.match(/^([a-z][a-z0-9]*)(?=[A-Z])/);
  if (camelMatch) return toKebabCase(camelMatch[1]);

  return undefined;
}

function modelTarget(namespace: string | undefined, loaded: LoadedDocument): TypeTarget {
  // enums 是公共类型出口，和 models/apis 平级，便于业务侧统一导入枚举
  if (namespace === 'enums') {
    return { rootDir: 'enums', modulePath: [], fileBase: 'common' };
  }

  // 共享 namespace 不和 service-local model 混在一起，避免单个服务文件变得过大
  if (namespace && namespace !== loaded.sourceModule) {
    return { rootDir: 'models', modulePath: [namespace], fileBase: 'common' };
  }

  // 默认按 Swagger 文件所在目录和文件名 1:1 输出，方便回溯来源文档
  return { rootDir: 'models', modulePath: [loaded.sourceModule], fileBase: loaded.sourceName };
}
