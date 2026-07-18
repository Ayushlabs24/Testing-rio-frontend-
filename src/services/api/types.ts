export interface ApiErrorPayload {
  message: string;
  status: number;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor({ message, status, details }: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
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
