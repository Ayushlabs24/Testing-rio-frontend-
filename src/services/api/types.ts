export interface ApiErrorPayload {
  message: string;
  status: number;
  details?: unknown;
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

  constructor({ message, status, details, cancelled }: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.cancelled = cancelled ?? false;
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
