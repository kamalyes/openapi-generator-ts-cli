# Refactor Plan: Pure TypeScript OpenAPI Generator

## Summary

- Replace the old Nx/Nest Java wrapper with a lightweight TypeScript CLI.
- Keep the package generic and public: no project-specific schema prefixes, module names, or hardcoded paths.
- Generate TypeScript API clients directly from OpenAPI/Swagger documents.
- Make docs optional and disabled by default.
- Group model files by source structure instead of generating one file per model.

## Public Interface

- `node dist/cli.js generate`
- `--input <file-or-url>` reads one OpenAPI document.
- `--swagger-glob <glob>` reads many local OpenAPI documents.
- `--output <dir>` controls the generated output directory.
- `--docs` enables module Markdown docs.
- `--clean` removes generated output folders before writing.

## Output Rules

- API files are grouped by the first operation tag and named like the classic TypeScript generator: `apis/<tag-api>.ts`.
- Service-local models are written 1:1 with OpenAPI source files: `models/<source-dir>/<source-file>.ts`.
- Shared schema namespaces are split away from service files: `commonXxx` -> `models/common/common.ts`; `enumsXxx` -> `enums/common.ts`.
- Duplicate schema names across multiple OpenAPI files are de-duplicated globally by schema name; the first source file owns the generated type.
- Every output directory ends with an `index.ts`.
- The generated root `index.ts` exports `api`, `models`, `enums`, and `configuration`; `api.ts` re-exports `apis/index.ts`.

## Type Rules

- OpenAPI objects generate `export interface`.
- OpenAPI enums generate string `export enum`.
- `$ref` references become local or cross-file TypeScript imports.
- Arrays, maps, primitive scalars, and inline objects map to TypeScript types.
- JSON field names are preserved.
- Swagger/OpenAPI `summary`, `description`, and `title` are preserved as TypeScript JSDoc comments.

## Validation

- Build the CLI with `npm run build`.
- Generate output with:

```bash
node dist/cli.js generate --swagger-glob "../openapi/**/*.swagger.yaml" --output "../generate" --clean
```

- Run TypeScript checking on the generated output.
