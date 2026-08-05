import type { BuildContext } from '../types.js';
export interface GeneratedFile {
    filePath: string;
    content: string;
}
export declare function generateModelFiles(context: BuildContext): GeneratedFile[];
export declare function modelIndexFiles(files: GeneratedFile[]): GeneratedFile[];
