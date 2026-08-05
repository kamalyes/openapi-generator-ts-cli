import { buildContext } from './build-context.js';
import { generateApiFiles, apiIndexFiles } from './generators/api-generator.js';
import { generateDocsFiles } from './generators/docs-generator.js';
import { generateModelFiles, modelIndexFiles } from './generators/model-generator.js';
import { loadOpenApiDocuments } from './openapi-loader.js';
import { cleanOutput, writeProject } from './writers/write-project.js';
import { staticFiles } from './writers/static-files.js';
export async function generate(options) {
    // 生成流程只围绕 OpenAPI/Swagger 文档展开：读取文档 -> 构建中间上下文 -> 写入 TS 文件
    const docs = await loadOpenApiDocuments(options);
    const context = buildContext(docs);
    const modelFiles = generateModelFiles(context);
    const apiFiles = generateApiFiles(context);
    const files = [
        ...modelFiles,
        ...modelIndexFiles(modelFiles),
        ...apiFiles,
        ...apiIndexFiles(apiFiles),
        ...staticFiles(),
    ];
    if (options.docs) {
        // docs 是显式可选项，默认不生成，避免污染客户端 SDK 输出目录
        files.push(...generateDocsFiles(context));
    }
    if (options.clean) {
        // clean 只清理生成器负责的目录和入口文件，避免误删调用方自己的文件
        await cleanOutput(options.output);
    }
    await writeProject(options.output, files);
    for (const warning of context.warnings) {
        console.warn(`[warn] ${warning}`);
    }
    console.log(`Generated ${files.length} files from ${docs.length} OpenAPI document(s) into ${options.output}`);
}
//# sourceMappingURL=generate.js.map