export interface ApiErrorPayload {
  message: string;
  status: number;
  details?: unknown;
  /** The backend's machine-readable error code from its `{ error: { code } }`
   * envelope (see AllExceptionsFilter). Present so callers can react to a
   * specific failure — localizing it, or mapping it onto the form field that
   * caused it — instead of displaying the server's English `message`. */
  code?: string;
  /** True only when the caller's own `signal` aborted the request — distinct
   * from a timeout (status 408) or a genuine network failure (status 0,
   * `cancelled` unset/false), so callers that need to ignore an expected
   * "I cancelled this myself" outcome can do so without misreading it as an
   * error to surface. */
  cancelled?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;
  readonly cancelled: boolean;
  readonly code?: string;

  constructor({ message, status, details, cancelled, code }: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.cancelled = cancelled ?? false;
    this.code = code;
  }
}

export type QueryParamValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryParamValue>;

export interface RequestOptions {
  params?: QueryParams;
  headers?: HeadersInit;
  signal?: AbortSignal;
  cache?: RequestCache;
  /** Overrides `apiConfig.timeoutMs` for this one call — e.g. AI
   * classification, which can genuinely take longer than the app-wide
   * default before Gemini responds. */
  timeoutMs?: number;
}
