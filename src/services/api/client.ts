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
      // The backend's session lives in an httpOnly cookie (see
      // auth.service.ts) — required for it to be sent/stored cross-origin
      // (frontend :3000, backend :4000). Harmless for same-origin calls.
      credentials: "include",
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : undefined;

    if (!response.ok) {
      // The backend's error responses are enveloped as { error: { code,
      // message, details? } } (see AllExceptionsFilter); fall back to a
      // flatter { message } shape for anything that doesn't follow that.
      throw new ApiError({
        message: payload?.error?.message ?? payload?.message ?? response.statusText,
        status: response.status,
        details: payload?.error?.details ?? payload,
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

interface UploadOptions {
  signal?: AbortSignal;
  /** 0-100. Only fires for upload (request-body) progress, not the response download. */
  onProgress?: (percent: number) => void;
}

/**
 * `fetch` has no upload-progress event, so file uploads go through
 * `XMLHttpRequest` instead — the one exception to "every request goes
 * through the plain `request()` helper above". Same base URL, credentials,
 * and `{ error: { code, message } }` envelope handling as the JSON path.
 */
function uploadForm<TResponse>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path));
    xhr.withCredentials = true;
    xhr.timeout = apiConfig.timeoutMs;

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new ApiError({ message: "Upload cancelled", status: 0 }));
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) return;
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      let payload: unknown;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        payload = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as TResponse);
        return;
      }
      const errorPayload = payload as
        { error?: { message?: string; details?: unknown }; message?: string } | undefined;
      reject(
        new ApiError({
          message:
            errorPayload?.error?.message ?? errorPayload?.message ?? xhr.statusText,
          status: xhr.status,
          details: errorPayload?.error?.details ?? payload,
        }),
      );
    };
    xhr.onerror = () => reject(new ApiError({ message: "Network error", status: 0 }));
    xhr.ontimeout = () =>
      reject(new ApiError({ message: "Request timed out", status: 408 }));
    xhr.onabort = () => reject(new ApiError({ message: "Upload cancelled", status: 0 }));

    xhr.send(formData);
  });
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
  uploadForm,
};
