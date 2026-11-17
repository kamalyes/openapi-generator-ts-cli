import type { BuildContext } from '../types.js';
import type { GeneratedFile } from './model-generator.js';
export declare function generateApiFiles(context: BuildContext): GeneratedFile[];
export declare function apiIndexFiles(files: GeneratedFile[]): GeneratedFile[];
