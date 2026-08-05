export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'patch' | 'head' | 'options';
export interface GeneratorOptions {
    inputs: string[];
    swaggerGlob?: string;
    output: string;
    docs: boolean;
    clean: boolean;
    headers: Record<string, string>;
    cwd: string;
}
export interface LoadedDocument {
    absolutePath?: string;
    sourceId: string;
    sourceModule: string;
    sourceName: string;
    document: OpenApiDocument;
}
export interface OpenApiDocument {
    swagger?: string;
    openapi?: string;
    info?: {
        title?: string;
        description?: string;
        version?: string;
    };
    host?: string;
    basePath?: string;
    schemes?: string[];
    paths?: Record<string, Record<string, OperationObject>>;
    definitions?: Record<string, SchemaObject>;
    components?: {
        schemas?: Record<string, SchemaObject>;
    };
}
export interface OperationObject {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject;
    responses?: Record<string, ResponseObject>;
}
export interface ParameterObject {
    name: string;
    in: 'query' | 'header' | 'path' | 'formData' | 'body' | string;
    required?: boolean;
    title?: string;
    description?: string;
    type?: string;
    format?: string;
    schema?: SchemaObject;
    items?: SchemaObject;
    enum?: Array<string | number | boolean | null>;
}
export interface RequestBodyObject {
    required?: boolean;
    description?: string;
    content?: Record<string, {
        schema?: SchemaObject;
    }>;
}
export interface ResponseObject {
    description?: string;
    schema?: SchemaObject;
    content?: Record<string, {
        schema?: SchemaObject;
    }>;
}
export interface SchemaObject {
    $ref?: string;
    type?: string;
    format?: string;
    title?: string;
    description?: string;
    enum?: Array<string | number | boolean | null>;
    properties?: Record<string, SchemaObject>;
    required?: string[];
    items?: SchemaObject;
    additionalProperties?: boolean | SchemaObject;
    allOf?: SchemaObject[];
    oneOf?: SchemaObject[];
    anyOf?: SchemaObject[];
}
export interface TypeTarget {
    rootDir?: 'models' | 'enums';
    modulePath: string[];
    fileBase: string;
}
export interface ModelDefinition {
    schemaName: string;
    typeName: string;
    schema: SchemaObject;
    target: TypeTarget;
}
export interface OperationDefinition {
    method: HttpMethod;
    path: string;
    operation: OperationObject;
    target: TypeTarget;
}
export interface BuildContext {
    models: ModelDefinition[];
    operations: OperationDefinition[];
    modelBySchema: Map<string, ModelDefinition>;
    warnings: string[];
}
