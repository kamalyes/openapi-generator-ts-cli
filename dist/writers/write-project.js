import fs from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';
const CLEAN_DIRS = ['apis', 'models', 'enums', 'docs', '.openapi-generator'];
const CLEAN_FILES = [
    'api.ts',
    'base.ts',
    'common.ts',
    'configuration.ts',
    'git_push.sh',
    'index.ts',
    '.gitignore',
    '.npmignore',
    '.openapi-generator-ignore',
];
export async function cleanOutput(output) {
    await Promise.all([
        ...CLEAN_DIRS.map((dir) => fs.rm(path.join(output, dir), { recursive: true, force: true })),
        ...CLEAN_FILES.map((file) => fs.rm(path.join(output, file), { force: true })),
    ]);
}
export async function writeProject(output, files) {
    for (const file of files) {
        const absolute = path.join(output, file.filePath);
        await fs.mkdir(path.dirname(absolute), { recursive: true });
        await fs.writeFile(absolute, await format(file.filePath, file.content), 'utf8');
    }
}
async function format(filePath, content) {
    const parser = filePath.endsWith('.md') ? 'markdown' : 'typescript';
    try {
        return await prettier.format(content, { parser, singleQuote: true, trailingComma: 'all' });
    }
    catch {
        return content.endsWith('\n') ? content : `${content}\n`;
    }
}
//# sourceMappingURL=write-project.js.map