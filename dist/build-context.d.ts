import type { BuildContext, GeneratorOptions, HttpMethod, LoadedDocument, SchemaObject, TypeTarget } from './types.js';
export declare function buildContext(docs: LoadedDocument[], options?: Pick<GeneratorOptions, 'methodStyle' | 'stripOperationPrefix'>): BuildContext;
export declare function refsInSchema(schema: SchemaObject | undefined): string[];
export declare function stableOperationName(method: HttpMethod, urlPath: string, operationId?: string): string;
export declare function targetKey(target: TypeTarget): string;
export declare function modelFilePath(target: TypeTarget): string;
