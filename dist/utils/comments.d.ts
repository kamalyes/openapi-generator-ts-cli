export interface CommentSource {
    title?: string;
    description?: string;
}
export declare function commentText(source: CommentSource | undefined): string | undefined;
export declare function jsDoc(lines: Array<string | undefined>, indent?: string): string;
export declare function jsDocFrom(source: CommentSource | undefined, indent?: string): string;
