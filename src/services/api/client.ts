import { apiConfig } from "@/services/api/config";
import { ApiError, type QueryParams, type RequestOptions } from "@/services/api/types";

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.replace(/^\//, ""), `${apiConfig.baseUrl}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function request<TResponse>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiConfig.timeoutMs);

  try {
    const response = await fetch(buildUrl(path, options.params), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options.signal ?? controller.signal,
      cache: options.cache,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : undefined;

    if (!response.ok) {
      throw new ApiError({
        message: payload?.message ?? response.statusText,
        status: response.status,
        details: payload,
      });
    }

    return payload as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError({ message: "Request timed out", status: 408 });
    }
    throw new ApiError({
      message: error instanceof Error ? error.message : "Network error",
      status: 0,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The only object in the app allowed to call `fetch`. Every service method
 * must go through this client so request handling (base URL, timeouts,
 * headers, error shape) stays consistent in one place.
 */
export const apiClient = {
  get: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>("GET", path, undefined, options),
  post: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>("POST", path, body, options),
  put: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>("PUT", path, body, options),
  patch: <TResponse>(path: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>("PATCH", path, body, options),
  delete: <TResponse>(path: string, options?: RequestOptions) =>
    request<TResponse>("DELETE", path, undefined, options),
};
