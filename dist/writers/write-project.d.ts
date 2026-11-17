import type { GeneratedFile } from '../generators/model-generator.js';
export declare function cleanOutput(output: string): Promise<void>;
export declare function writeProject(output: string, files: GeneratedFile[]): Promise<void>;
