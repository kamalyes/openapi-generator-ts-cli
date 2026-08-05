import path from 'node:path';
import { Command } from 'commander';
export function parseOptions(argv, cwd = process.cwd()) {
    const program = new Command();
    program
        .name('openapi-generator-ts-cli')
        .description('Generate a TypeScript OpenAPI client')
        .version('0.1.0');
    program
        .command('generate')
        .description('generate TypeScript client files')
        .option('-i, --input <file-or-url...>', 'OpenAPI JSON/YAML file or URL')
        .option('-g, --swagger-glob <glob>', 'glob for local OpenAPI JSON/YAML files')
        .option('-o, --output <dir>', 'output directory', 'generate')
        .option('-H, --header <header...>', 'HTTP header for remote OpenAPI URLs, for example: "Authorization: Bearer token"')
        .option('--bearer-token <token>', 'Bearer token for remote OpenAPI URLs')
        .option('--docs', 'generate Markdown docs', false)
        .option('--clean', 'remove generated output folders before writing', false)
        .action((raw) => {
        const inputs = Array.isArray(raw.input) ? raw.input : raw.input ? [raw.input] : [];
        const headers = parseHeaders(raw.header);
        if (raw.bearerToken) {
            headers.Authorization = `Bearer ${raw.bearerToken}`;
        }
        const options = {
            inputs,
            swaggerGlob: raw.swaggerGlob,
            output: path.resolve(cwd, raw.output),
            docs: Boolean(raw.docs),
            clean: Boolean(raw.clean),
            headers,
            cwd,
        };
        validateOptions(options);
        program.setOptionValue('__generatorOptions', options);
    });
    program.parse(argv);
    const options = program.getOptionValue('__generatorOptions');
    if (!options) {
        program.help();
        throw new Error('No command selected.');
    }
    return options;
}
function validateOptions(options) {
    if (!options.inputs.length && !options.swaggerGlob) {
        throw new Error('Provide --input or --swagger-glob.');
    }
}
function parseHeaders(value) {
    const headers = {};
    const items = Array.isArray(value) ? value : value ? [value] : [];
    for (const item of items) {
        const raw = String(item);
        const separator = raw.indexOf(':');
        if (separator <= 0) {
            throw new Error(`Invalid --header value "${raw}". Expected "Name: value".`);
        }
        const name = raw.slice(0, separator).trim();
        const headerValue = raw.slice(separator + 1).trim();
        if (!name || !headerValue) {
            throw new Error(`Invalid --header value "${raw}". Expected "Name: value".`);
        }
        headers[name] = headerValue;
    }
    return headers;
}
//# sourceMappingURL=config.js.map