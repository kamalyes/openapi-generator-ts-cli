import { refName, safeFileBase, toKebabCase, toPascalCase } from './utils/names.js';
const HTTP_METHODS = new Set([
    'get',
    'put',
    'post',
    'delete',
    'patch',
    'head',
    'options',
]);
export function buildContext(docs) {
    const warnings = [];
    const models = [];
    const modelBySchema = new Map();
    const ownerBySchema = new Map();
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
    const operations = [];
    // API 以 Swagger tag 为生成文件维度，保持和常见 typescript-axios 输出习惯接近
    for (const loaded of docs) {
        for (const [urlPath, pathItem] of Object.entries(loaded.document.paths ?? {})) {
            for (const [method, operation] of Object.entries(pathItem)) {
                const normalizedMethod = method.toLowerCase();
                if (!HTTP_METHODS.has(normalizedMethod))
                    continue;
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
    return { models, operations, modelBySchema, warnings };
}
function collectSchemas(document) {
    return {
        ...(document.definitions ?? {}),
        ...(document.components?.schemas ?? {}),
    };
}
function createModel(schemaName, schema, loaded) {
    const typeName = toPascalCase(schemaName);
    const namespace = schemaNamespace(schemaName);
    return {
        schemaName,
        typeName,
        schema,
        target: modelTarget(namespace, loaded),
    };
}
export function refsInSchema(schema) {
    if (!schema)
        return [];
    const refs = new Set();
    const visit = (node) => {
        if (!node)
            return;
        if (node.$ref)
            refs.add(refName(node.$ref));
        visit(node.items);
        if (typeof node.additionalProperties === 'object')
            visit(node.additionalProperties);
        for (const child of Object.values(node.properties ?? {}))
            visit(child);
        for (const child of [...(node.allOf ?? []), ...(node.oneOf ?? []), ...(node.anyOf ?? [])])
            visit(child);
    };
    visit(schema);
    return Array.from(refs);
}
export function stableOperationName(method, urlPath, operationId) {
    if (operationId)
        return toPascalCase(operationId).replace(/^./, (c) => c.toLowerCase());
    return toPascalCase(`${method}_${urlPath}`).replace(/^./, (c) => c.toLowerCase());
}
export function targetKey(target) {
    return [target.rootDir ?? 'models', ...target.modulePath, target.fileBase].join('/');
}
export function modelFilePath(target) {
    return [target.rootDir ?? 'models', ...target.modulePath, safeFileBase(target.fileBase)].join('/');
}
function apiFileBase(tag) {
    return safeFileBase(`${tag || 'Default'}Api`);
}
function schemaNamespace(schemaName) {
    const snakeMatch = schemaName.match(/^([a-z][a-z0-9_]+)[A-Z]/);
    if (snakeMatch)
        return toKebabCase(snakeMatch[1]);
    const camelMatch = schemaName.match(/^([a-z][a-z0-9]*)(?=[A-Z])/);
    if (camelMatch)
        return toKebabCase(camelMatch[1]);
    return undefined;
}
function modelTarget(namespace, loaded) {
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
//# sourceMappingURL=build-context.js.map