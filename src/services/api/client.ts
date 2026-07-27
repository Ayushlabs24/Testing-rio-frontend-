import { apiConfig } from "@/services/api/config";
import { ApiError, type QueryParams, type RequestOptions } from "@/services/api/types";

const CSRF_COOKIE_NAME = "rio_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Backend double-submit CSRF (see CsrfGuard): a mutating request while a
// rio_session cookie is present must echo the readable rio_csrf cookie back
// as this header, or it's rejected with CSRF_TOKEN_INVALID regardless of a
// valid session. Only relevant browser-side — SSR/no-cookie contexts (and
// GET/HEAD/OPTIONS, which the backend never checks) just send nothing.
function readCsrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

/**
 * Combines the internal timeout signal with an optional caller-supplied
 * signal so a caller's own `AbortSignal` never disables the timeout (and
 * vice versa) — both must be able to abort the same request independently.
 * Prefers the native `AbortSignal.any` (all evergreen browsers since 2023);
 * falls back to manual event forwarding, cleaned up by the caller via the
 * returned `cleanup()`.
 */
function composeSignals(signals: AbortSignal[]): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  if (typeof AbortSignal.any === "function") {
    return { signal: AbortSignal.any(signals), cleanup: () => {} };
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener("abort", onAbort);
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      for (const s of signals) s.removeEventListener("abort", onAbort);
    },
  };
}

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

/**
 * Sets up the composed timeout+caller signal for one request and returns
 * everything both `request()` and `download()` need to run it and clean up
 * afterward — shared so the two transports can never drift on timeout or
 * cancellation behavior.
 */
function beginAbortable(options: Pick<RequestOptions, "signal" | "timeoutMs">) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    options.timeoutMs ?? apiConfig.timeoutMs,
  );
  // Both the internal timeout and a caller-supplied signal must be able to
  // abort independently — passing only one or the other (as this used to)
  // silently disabled whichever wasn't chosen. See composeSignals' comment.
  const { signal, cleanup } = composeSignals(
    options.signal
      ? [timeoutController.signal, options.signal]
      : [timeoutController.signal],
  );
  return {
    signal,
    finish: () => {
      clearTimeout(timeout);
      cleanup();
    },
    /**
     * Maps a caught error to the right typed `ApiError` — distinguishing a
     * caller-initiated cancellation (`options.signal` aborted, timeout
     * didn't) from the internal timeout firing, from a genuine network
     * failure. Both abort causes surface as the same DOMException from
     * `fetch`, so checking which underlying signal actually aborted is the
     * only way to tell them apart afterward.
     */
    toApiError: (error: unknown): ApiError => {
      if (error instanceof ApiError) return error;
      if (error instanceof DOMException && error.name === "AbortError") {
        if (options.signal?.aborted && !timeoutController.signal.aborted) {
          return new ApiError({
            message: "Request cancelled",
            status: 0,
            cancelled: true,
          });
        }
        return new ApiError({ message: "Request timed out", status: 408 });
      }
      return new ApiError({
        message: error instanceof Error ? error.message : "Network error",
        status: 0,
      });
    },
  };
}

async function request<TResponse>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { signal, finish, toApiError } = beginAbortable(options);

  try {
    const csrfToken = SAFE_METHODS.has(method) ? undefined : readCsrfCookie();
    const response = await fetch(buildUrl(path, options.params), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
        ...options.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
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
    throw toApiError(error);
  } finally {
    finish();
  }
}

export interface DownloadResult {
  blob: Blob;
  /** Resolved from the response's `Content-Disposition` header when
   * present, otherwise the caller-supplied fallback. */
  filename: string;
}

/**
 * Binary/blob downloads (report/export PDFs, Excel, CSV) — a GET request
 * that returns a file body instead of JSON, so it can't go through
 * `request()`'s `response.json()` parsing. Shares the same base URL,
 * timeout/cancellation, credentials, and `ApiError` envelope handling as
 * every other request; the one thing it doesn't share is a JSON body, since
 * there isn't one.
 */
async function download(
  path: string,
  defaultFilename: string,
  options: RequestOptions = {},
): Promise<DownloadResult> {
  const { signal, finish, toApiError } = beginAbortable(options);

  try {
    const response = await fetch(buildUrl(path, options.params), {
      signal,
      cache: options.cache,
      credentials: "include",
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => undefined);
      throw new ApiError({
        message: payload?.error?.message ?? payload?.message ?? response.statusText,
        status: response.status,
        details: payload?.error?.details ?? payload,
      });
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/.exec(disposition);
    return { blob, filename: filenameMatch?.[1] ?? defaultFilename };
  } catch (error) {
    throw toApiError(error);
  } finally {
    finish();
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
    const csrfToken = readCsrfCookie();
    if (csrfToken) xhr.setRequestHeader(CSRF_HEADER_NAME, csrfToken);

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
  download,
};
