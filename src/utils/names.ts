import path from 'node:path';

const RESERVED_WORDS = new Set([
  'break',
  'case',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
]);

export function toKebabCase(input: string): string {
  return input
    .replace(/\.swagger$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s.]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function toPascalCase(input: string): string {
  const cleaned = input
    .replace(/^[^a-zA-Z]+/, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();

  const value = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part === part.toUpperCase() && part.length > 1) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');

  if (!value) return 'GeneratedType';
  return /^[0-9]/.test(value) ? `Type${value}` : value;
}

export function toCamelCase(input: string): string {
  const pascal = toPascalCase(input);
  const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
  return RESERVED_WORDS.has(camel) ? `${camel}Value` : camel;
}

export function quoteProperty(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !RESERVED_WORDS.has(name)
    ? name
    : JSON.stringify(name);
}

export function normalizeKey(input: string): string {
  return input.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

export function refName(ref: string): string {
  const marker = ref.includes('/components/schemas/')
    ? '/components/schemas/'
    : '/definitions/';
  return decodeURIComponent(ref.slice(ref.lastIndexOf(marker) + marker.length));
}

export function posixRelativeImport(fromDir: string, toFileNoExt: string): string {
  let rel = path.posix.relative(fromDir, toFileNoExt);
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

export function pathPartsToDir(parts: string[]): string {
  return parts.map(toKebabCase).filter(Boolean).join('/');
}

export function safeFileBase(input: string): string {
  return toKebabCase(input) || 'index';
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
