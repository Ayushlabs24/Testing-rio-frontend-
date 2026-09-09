import { ApiError } from "@/services/api/types";

/**
 * Client-reported gap (2026-09-09): failed API calls were showing the
 * backend's raw English `error.message` ("Invalid email or password") even
 * on the Arabic UI, because every catch block did
 * `error instanceof ApiError ? error.message : t("genericError")` — the
 * translated fallback only ever fired for network failures, never for a
 * real API rejection, which is the common case.
 *
 * `ApiError.code` is the backend's stable, machine-readable error code (see
 * `{ error: { code, message } }` on every thrown exception). `knownCodes`
 * is the same, plainly-typed list of codes a call site's own i18n dictionary
 * has an entry for (e.g. `AUTH_API_ERROR_CODES` below) — checked as a plain
 * array membership test rather than through next-intl's `t.has`, which was
 * found unreliable here: in at least one render path (reproduced in
 * signup-form.test.tsx) the translator next-intl hands back is missing its
 * `.has`/`.rich`/`.raw` properties entirely despite being the real, working
 * translate function, so calling `t.has(...)` on it throws. A plain array
 * membership check has no such dependency. An `ApiError` whose code isn't in
 * the list (or has none) falls back to `fallback` rather than leaking the
 * English message.
 */
export function getApiErrorMessage(
  error: unknown,
  knownCodes: readonly string[],
  t: (key: string) => string,
  fallback: string,
): string {
  if (error instanceof ApiError && error.code && knownCodes.includes(error.code)) {
    return t(error.code);
  }
  return fallback;
}

/** Mirrors the keys under the `auth.apiErrors` namespace in
 * messages/en.json and messages/ar.json — keep in sync by hand when adding
 * a new mapped code there. */
export const AUTH_API_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "ACCOUNT_LOCKED",
  "USER_DISABLED",
  "ORG_INACTIVE",
  "UNAUTHENTICATED",
  "INVALID_CURRENT_PASSWORD",
  "INVALID_RESET_TOKEN",
  "INVALID_SECTOR",
  "INVALID_ROLE",
  "EMAIL_ALREADY_REGISTERED",
  "ORGANIZATION_ALREADY_REGISTERED",
  "REGISTRATION_NUMBER_NOT_RECOGNISED",
  "CONSENT_VERSION_STALE",
  "NO_ACTIVE_CONSENT_POLICY",
  "OTP_INCORRECT",
  "OTP_EXPIRED",
  "OTP_ALREADY_USED",
  "OTP_TOO_MANY_ATTEMPTS",
  "OTP_CHALLENGE_NOT_FOUND",
  "OTP_NOT_VERIFIED",
  "ORG_NOT_FOUND",
  "NO_CONTACT_RECIPIENT",
  "CONTACT_DELIVERY_FAILED",
] as const;

/** Mirrors `app.archive.uploadHistorical.apiErrors` in the message files. */
export const HISTORICAL_UPLOAD_API_ERROR_CODES = [
  "FILE_REQUIRED",
  "MISSING_FIELDS",
] as const;

/** Mirrors `app.studies.import.apiErrors` in the message files — shared by
 * both the Import Needs and Import Survey Results dialogs, which read from
 * the same needs-import backend endpoints and error codes. */
export const NEEDS_IMPORT_API_ERROR_CODES = [
  "NO_FILE",
  "UNSUPPORTED_FILE_TYPE",
  "PDF_PARSING_FAILED",
  "SURVEY_PARSING_FAILED",
  "STUDY_NOT_FOUND",
  "EMPTY_PAYLOAD",
  "IMPORT_TOO_LARGE",
] as const;
