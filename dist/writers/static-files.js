export function staticFiles() {
    return [
        {
            filePath: 'configuration.ts',
            content: `export interface ConfigurationParameters {
  basePath?: string;
  headers?: object;
}

export class Configuration {
  readonly basePath: string;
  readonly headers: object;

  constructor(parameters: ConfigurationParameters = {}) {
    this.basePath = parameters.basePath ?? '';
    this.headers = parameters.headers ?? {};
  }
}
`,
        },
        {
            filePath: 'base.ts',
            content: `import { Configuration } from './configuration';

export interface RequestArgs {
  method?: string;
  url?: string;
  params?: Record<string, unknown>;
  headers?: object;
  data?: unknown;
}

export interface AxiosLikeInstance {
  request<T = unknown>(config: RequestArgs): Promise<{ data: T }>;
}

// 默认请求适配器用于支持无参 new XxxApi()；业务项目仍可传入 axios 实例覆盖
type FetchLike = (
  input: string,
  init?: unknown,
) => Promise<{
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const fetchAxiosLikeInstance: AxiosLikeInstance = {
  async request<T = unknown>(config: RequestArgs): Promise<{ data: T }> {
    const fetchFn = (globalThis as { fetch?: FetchLike }).fetch;
    if (typeof fetchFn !== 'function') {
      throw new Error('No Axios-like instance was supplied, and global fetch is unavailable.');
    }

    const response = await fetchFn(appendQuery(config.url ?? '', config.params), {
      method: config.method,
      headers: config.headers,
      body: serializeBody(config.data),
    });
    const contentType = response.headers.get('content-type') ?? '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    return { data: data as T };
  },
};

export class BaseAPI {
  protected readonly configuration: Configuration;
  protected readonly axios: AxiosLikeInstance;

  constructor(configuration = new Configuration(), axios: AxiosLikeInstance = fetchAxiosLikeInstance) {
    this.configuration = configuration;
    this.axios = axios;
  }

  protected async request<T>(args: RequestArgs): Promise<T> {
    // 基础配置和单次请求配置在这里合并，具体 API 方法只负责提供路径、参数和 body
    const response = await this.axios.request<T>({
      ...args,
      url: \`\${this.configuration.basePath}\${args.url ?? ''}\`,
      headers: {
        ...this.configuration.headers,
        ...(args.headers ?? {}),
      },
    });
    return response.data;
  }
}

function appendQuery(url: string, params: Record<string, unknown> | undefined): string {
  const pairs = Object.entries(params ?? {}).flatMap(([key, value]) => {
    if (value === undefined || value === null) return [];
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => \`\${encodeURIComponent(key)}=\${encodeURIComponent(String(item))}\`);
  });
  if (pairs.length === 0) return url;
  return \`\${url}\${url.includes('?') ? '&' : '?'}\${pairs.join('&')}\`;
}

function serializeBody(data: unknown): unknown {
  if (data === undefined || data === null || typeof data === 'string') return data;
  return JSON.stringify(data);
}
`,
        },
        {
            filePath: 'common.ts',
            content: `export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
`,
        },
        {
            filePath: 'index.ts',
            content: `export * from './api';
export * from './models';
export * from './enums';
export * from './configuration';
`,
        },
        {
            filePath: 'api.ts',
            content: `export * from './apis';
`,
        },
    ];
}
//# sourceMappingURL=static-files.js.map