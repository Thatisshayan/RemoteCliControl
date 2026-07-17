type SchemaParser<T> = {
  parse(data: unknown): T;
};

const envBaseUrl =
  typeof process !== "undefined" && typeof process.env?.EXPO_PUBLIC_DOMAIN === "string"
    ? process.env.EXPO_PUBLIC_DOMAIN
    : undefined;

const DEFAULT_BASE_URL = envBaseUrl
  ? (envBaseUrl.startsWith("http") ? envBaseUrl : `http://${envBaseUrl}`).replace(/\/$/, "")
  : "http://localhost:3000";

let baseUrl = DEFAULT_BASE_URL;
let apiToken: string | undefined;

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, "");
}

export function getBaseUrl() {
  return baseUrl;
}

export function setApiToken(token?: string) {
  apiToken = token?.trim() || undefined;
}

export function getApiToken() {
  return apiToken;
}

export function getAuthHeaders(extraHeaders?: Record<string, string>) {
  return {
    ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
    ...(extraHeaders || {}),
  };
}

export function buildWebSocketUrl(path: string) {
  const base = new URL(baseUrl);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = path.startsWith("/") ? path : `/${path}`;
  base.search = "";
  return base.toString();
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  schema?: SchemaParser<any>;
  useApiPrefix?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, schema, useApiPrefix = true, ...fetchOptions } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let url = `${baseUrl}${useApiPrefix ? "/api" : ""}${normalizedPath}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (fetchOptions.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  Object.assign(headers, getAuthHeaders());
  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText, code: `HTTP_${res.status}` }));
    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.error?.message === "string"
          ? body.error.message
          : res.statusText;
    const error = new Error(message || `HTTP ${res.status}`);
    (error as Error & { code?: string; details?: unknown }).code =
      typeof body?.code === "string"
        ? body.code
        : typeof body?.error?.code === "string"
          ? body.error.code
          : `HTTP_${res.status}`;
    (error as Error & { details?: unknown }).details = body?.details ?? body?.error?.details;
    throw error;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const json = await res.json();
  return schema ? schema.parse(json) : (json as T);
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>, schema?: SchemaParser<T>) =>
    request<T>(path, { method: "GET", params, schema }),
  post: <T>(path: string, body?: unknown, params?: Record<string, string>, schema?: SchemaParser<T>) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, params, schema }),
  patch: <T>(path: string, body?: unknown, params?: Record<string, string>, schema?: SchemaParser<T>) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, params, schema }),
  put: <T>(path: string, body?: unknown, params?: Record<string, string>, schema?: SchemaParser<T>) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, params, schema }),
  delete: <T>(path: string, params?: Record<string, string>, schema?: SchemaParser<T>) =>
    request<T>(path, { method: "DELETE", params, schema }),
};

export const publicApi = {
  get: <T>(path: string, params?: Record<string, string>, schema?: SchemaParser<T>) =>
    request<T>(path, { method: "GET", params, schema, useApiPrefix: false }),
};
