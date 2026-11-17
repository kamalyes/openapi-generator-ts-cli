import { targetKey } from '../build-context.js';
export function generateDocsFiles(context) {
    const byTarget = new Map();
    for (const operation of context.operations) {
        const key = targetKey(operation.target);
        const lines = byTarget.get(key) ?? [];
        lines.push(`- \`${operation.method.toUpperCase()} ${operation.path}\` ${operation.operation.summary ?? ''}`.trim());
        byTarget.set(key, lines);
    }
    return Array.from(byTarget.entries()).map(([key, lines]) => ({
        filePath: `docs/${key}.md`,
        content: [`# ${key}`, '', ...lines.sort()].join('\n'),
    }));
}
//# sourceMappingURL=docs-generator.js.map