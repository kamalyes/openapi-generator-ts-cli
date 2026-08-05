import path from 'node:path';
import { modelFilePath, refsInSchema, targetKey } from '../build-context.js';
import { posixRelativeImport, quoteProperty, refName, toPascalCase, uniqueSorted, } from '../utils/names.js';
import { jsDocFrom } from '../utils/comments.js';
import { generatedHeader } from '../utils/metadata.js';
export function generateModelFiles(context) {
    const groups = new Map();
    for (const model of context.models) {
        const key = targetKey(model.target);
        const models = groups.get(key) ?? [];
        models.push(model);
        groups.set(key, models);
    }
    return Array.from(groups.values()).map((models) => generateModelFile(models, context));
}
function generateModelFile(models, context) {
    const target = models[0].target;
    const fileNoExt = modelFilePath(target);
    const fromDir = path.posix.dirname(fileNoExt);
    const imports = collectModelImports(models, context, fromDir, fileNoExt);
    const body = models
        .sort((a, b) => a.typeName.localeCompare(b.typeName))
        .map((model) => renderModel(model, context))
        .join('\n\n');
    return {
        filePath: `${fileNoExt}.ts`,
        content: [header(), imports, body].filter(Boolean).join('\n\n'),
    };
}
function collectModelImports(models, context, fromDir, currentFileNoExt) {
    const importsByPath = new Map();
    const localNames = new Set(models.map((model) => model.typeName));
    for (const model of models) {
        for (const schemaRef of refsInSchema(model.schema)) {
            const refModel = context.modelBySchema.get(schemaRef);
            if (!refModel || localNames.has(refModel.typeName))
                continue;
            const toFileNoExt = modelFilePath(refModel.target);
            if (toFileNoExt === currentFileNoExt)
                continue;
            const importPath = posixRelativeImport(fromDir, toFileNoExt);
            const names = importsByPath.get(importPath) ?? new Set();
            names.add(refModel.typeName);
            importsByPath.set(importPath, names);
        }
    }
    return Array.from(importsByPath.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([importPath, names]) => `import type { ${uniqueSorted(names).join(', ')} } from '${importPath}';`)
        .join('\n');
}
function renderModel(model, context) {
    if (model.schema.enum) {
        return renderEnum(model.typeName, model.schema.enum, model.schema);
    }
    const schema = flattenSchema(model.schema);
    if (schema.enum) {
        return renderEnum(model.typeName, schema.enum, schema);
    }
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const lines = Object.entries(properties)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, property]) => {
        const optional = required.has(name) ? '' : '?';
        return [
            jsDocFrom(property, '  '),
            `  ${quoteProperty(name)}${optional}: ${schemaToType(property, context)};`,
        ].filter(Boolean).join('\n');
    });
    if (lines.length === 0 && typeof schema.additionalProperties === 'object') {
        lines.push(`  [key: string]: ${schemaToType(schema.additionalProperties, context)};`);
    }
    else if (lines.length === 0 && schema.additionalProperties === true) {
        lines.push('  [key: string]: unknown;');
    }
    return [jsDocFrom(schema), `export interface ${model.typeName} {\n${lines.join('\n')}\n}`]
        .filter(Boolean)
        .join('\n');
}
function renderEnum(typeName, values, schema) {
    const used = new Set();
    const lines = values.map((value, index) => {
        const raw = String(value);
        let key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(raw) ? raw : toPascalCase(raw);
        if (!key)
            key = `Value${index + 1}`;
        if (/^[0-9]/.test(key))
            key = `Value${key}`;
        while (used.has(key))
            key = `${key}_${index + 1}`;
        used.add(key);
        return `  ${key} = ${JSON.stringify(raw)},`;
    });
    return [jsDocFrom(schema), `export enum ${typeName} {\n${lines.join('\n')}\n}`]
        .filter(Boolean)
        .join('\n');
}
function schemaToType(schema, context) {
    if (!schema)
        return 'unknown';
    if (schema.$ref) {
        const model = context.modelBySchema.get(refName(schema.$ref));
        return model?.typeName ?? 'unknown';
    }
    if (schema.allOf?.length)
        return schema.allOf.map((item) => schemaToType(item, context)).join(' & ');
    if (schema.oneOf?.length)
        return schema.oneOf.map((item) => schemaToType(item, context)).join(' | ');
    if (schema.anyOf?.length)
        return schema.anyOf.map((item) => schemaToType(item, context)).join(' | ');
    if (schema.enum?.length)
        return schema.enum.map((value) => JSON.stringify(String(value))).join(' | ');
    if (schema.type === 'array')
        return `Array<${schemaToType(schema.items, context)}>`;
    if (schema.type === 'object') {
        if (schema.properties && Object.keys(schema.properties).length > 0) {
            const required = new Set(schema.required ?? []);
            const fields = Object.entries(schema.properties)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, property]) => `${quoteProperty(name)}${required.has(name) ? '' : '?'}: ${schemaToType(property, context)}`);
            return `{ ${fields.join('; ')} }`;
        }
        if (typeof schema.additionalProperties === 'object') {
            return `Record<string, ${schemaToType(schema.additionalProperties, context)}>`;
        }
        return 'Record<string, unknown>';
    }
    if (schema.type === 'integer' || schema.type === 'number')
        return 'number';
    if (schema.type === 'boolean')
        return 'boolean';
    if (schema.type === 'string')
        return 'string';
    return 'unknown';
}
function flattenSchema(schema) {
    if (!schema.allOf?.length)
        return schema;
    return schema.allOf.reduce((acc, child) => ({
        ...acc,
        ...child,
        properties: {
            ...(acc.properties ?? {}),
            ...(child.properties ?? {}),
        },
        required: [...(acc.required ?? []), ...(child.required ?? [])],
    }), { ...schema, allOf: undefined });
}
function header() {
    return generatedHeader();
}
export function modelIndexFiles(files) {
    const modelDirs = new Map();
    const modelRootDirs = new Set();
    const enumFiles = new Set();
    for (const file of files) {
        const parsed = path.posix.parse(file.filePath);
        const parts = parsed.dir.split('/').filter(Boolean);
        if (parts[0] === 'enums') {
            if (parts.length === 1)
                enumFiles.add(parsed.name);
            continue;
        }
        if (parts[0] !== 'models')
            continue;
        if (parts.length > 1)
            modelRootDirs.add(parts[1]);
        const key = parts.join('/');
        const names = modelDirs.get(key) ?? new Set();
        names.add(parsed.name);
        modelDirs.set(key, names);
    }
    const indexFiles = [];
    for (const [dir, names] of modelDirs.entries()) {
        indexFiles.push({
            filePath: `${dir}/index.ts`,
            content: uniqueSorted(names)
                .filter((name) => name !== 'index')
                .map((name) => `export * from './${name}';`)
                .join('\n'),
        });
    }
    indexFiles.push({
        filePath: 'models/index.ts',
        content: uniqueSorted(modelRootDirs).map((dir) => `export * from './${dir}';`).join('\n'),
    });
    indexFiles.push({
        filePath: 'enums/index.ts',
        content: uniqueSorted(enumFiles)
            .filter((name) => name !== 'index')
            .map((name) => `export * from './${name}';`)
            .join('\n'),
    });
    return indexFiles;
}
//# sourceMappingURL=model-generator.js.map