import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import YAML from 'yaml';
import { safeFileBase, toKebabCase } from './utils/names.js';
export async function loadOpenApiDocuments(options) {
    const sources = await collectSources(options);
    const docs = [];
    for (const source of sources) {
        const content = await readSource(source, options);
        const document = YAML.parse(content);
        const sourceInfo = describeSource(source, options.cwd);
        docs.push({ ...sourceInfo, document });
    }
    return docs;
}
async function collectSources(options) {
    const sources = [...options.inputs];
    if (options.swaggerGlob) {
        const matches = await fg(options.swaggerGlob, {
            cwd: options.cwd,
            absolute: true,
            onlyFiles: true,
            unique: true,
        });
        sources.push(...matches);
    }
    return Array.from(new Set(sources)).sort((a, b) => a.localeCompare(b));
}
async function readSource(source, options) {
    if (/^https?:\/\//i.test(source)) {
        let response;
        try {
            response = await fetch(source, { headers: options.headers });
        }
        catch (err) {
            const cause = err instanceof Error ? err.cause : undefined;
            const code = cause instanceof Error ? cause.message : String(cause ?? err);
            throw new Error(`无法获取 OpenAPI 文档: ${source}\n  原因: ${code}\n  请检查:\n    1. 服务是否已启动\n    2. URL 是否正确\n    3. 网络是否可达`);
        }
        if (!response.ok) {
            throw new Error(`获取 OpenAPI 文档失败: ${source}\n  HTTP ${response.status} ${response.statusText}`);
        }
        return response.text();
    }
    try {
        return await fs.readFile(path.resolve(options.cwd, source), 'utf8');
    }
    catch (err) {
        const code = err instanceof Error ? err.message : String(err);
        throw new Error(`无法读取文件: ${source}\n  原因: ${code}\n  请检查路径是否正确`);
    }
}
function describeSource(source, cwd) {
    if (/^https?:\/\//i.test(source)) {
        const url = new URL(source);
        const base = path.posix.basename(url.pathname) || 'openapi';
        return {
            sourceId: source,
            sourceModule: 'remote',
            sourceName: safeFileBase(base.replace(/\.(json|ya?ml)$/i, '')),
        };
    }
    const absolutePath = path.resolve(cwd, source);
    const modulePart = path.basename(path.dirname(absolutePath));
    const base = path.basename(absolutePath).replace(/\.(json|ya?ml)$/i, '');
    return {
        absolutePath,
        sourceId: path.relative(cwd, absolutePath),
        sourceModule: toKebabCase(modulePart) || 'default',
        sourceName: safeFileBase(base),
    };
}
//# sourceMappingURL=openapi-loader.js.map