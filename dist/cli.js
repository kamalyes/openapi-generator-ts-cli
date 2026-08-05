#!/usr/bin/env node
import { parseOptions } from './config.js';
import { generate } from './generate.js';
try {
    const options = parseOptions(process.argv);
    await generate(options);
}
catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] ${message}`);
    process.exitCode = 1;
}
//# sourceMappingURL=cli.js.map