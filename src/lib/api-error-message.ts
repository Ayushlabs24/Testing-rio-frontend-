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

/**
 * App-wide version of the above: the backend error codes that have a
 * user-facing entry under the top-level `apiErrors` namespace in
 * messages/{en,ar}.json. Use `resolveApiErrorMessage` from any catch block
 * instead of `error instanceof ApiError ? error.message : fallback` — that
 * old pattern leaked the backend's raw English message on the Arabic UI for
 * every real API rejection (the localized fallback only ever fired for a
 * network failure). Keep this list in sync with that namespace by hand.
 */
export const GLOBAL_API_ERROR_CODES = [
  "ACCOUNT_LOCKED",
  "ACT_AS_ORG_INACTIVE",
  "ACT_AS_ORG_NOT_FOUND",
  "AI_CLASSIFICATION_NOT_APPROVED",
  "AI_RATE_LIMITED",
  "AI_TIMEOUT",
  "AI_UNAVAILABLE",
  "ALREADY_IMPORTED",
  "ANSWER_OPTIONS_REQUIRED",
  "AUDIT_LOG_NOT_FOUND",
  "AUTHOR_REQUIRED",
  "CANNOT_DISABLE_SELF",
  "CANNOT_REMOVE_SELF",
  "CENTER_GOVERNORATE_MISMATCH",
  "CENTER_NOT_FOUND",
  "CENTER_NOT_IN_ORG_SCOPE",
  "CENTER_NOT_IN_STUDY_SCOPE",
  "CONSENT_POLICY_NOT_APPROVED",
  "CONSENT_POLICY_NOT_FOUND",
  "CONSENT_VERSION_STALE",
  "CSRF_TOKEN_INVALID",
  "DECISION_ALREADY_TERMINAL",
  "DECISION_NOT_FOUND",
  "DOMAIN_NOT_FOUND",
  "DUPLICATE_SUBMISSION",
  "EMAIL_ALREADY_REGISTERED",
  "EMAIL_TAKEN",
  "EMPTY_PAYLOAD",
  "EVIDENCE_LIMIT_REACHED",
  "EVIDENCE_NOT_DELETABLE",
  "EVIDENCE_NOT_EDITABLE",
  "EVIDENCE_NOT_FOUND",
  "EXPORT_FORMAT_NOT_SUPPORTED",
  "FILE_CONTENT_MISMATCH",
  "FILE_NOT_FOUND",
  "FILE_REQUIRED",
  "FILE_TOO_LARGE",
  "FORBIDDEN",
  "FORBIDDEN_ROLE",
  "FORBIDDEN_ROLE_ASSIGNMENT",
  "FORBIDDEN_USER_REMOVAL",
  "GOVERNORATE_NOT_FOUND",
  "GOVERNORATE_NOT_IN_ORG_SCOPE",
  "GOVERNORATE_NOT_IN_STUDY_SCOPE",
  "GOVERNORATE_REGION_MISMATCH",
  "GRANTEE_NOT_FOUND",
  "GRANTEE_NOT_SUPERVISOR",
  "GRANT_ALREADY_ACTIVE",
  "GRANT_ALREADY_REVOKED",
  "GRANT_NOT_FOUND",
  "HISTORICAL_STUDY_NOT_FOUND",
  "IMPORT_TOO_LARGE",
  "INACTIVE_ORG",
  "INITIATIVE_NOT_FOUND",
  "INVALID_ASSIGNMENT_PAYLOAD",
  "INVALID_CREDENTIALS",
  "INVALID_CURRENT_PASSWORD",
  "INVALID_DATE_RANGE",
  "INVALID_DECISION_TYPE",
  "INVALID_FACTOR_SCALE",
  "INVALID_GAP_TYPE",
  "INVALID_GEO_LEVEL",
  "INVALID_METHODOLOGY_VERSION",
  "INVALID_RESET_TOKEN",
  "INVALID_ROLE",
  "INVALID_SECTOR",
  "INVALID_STUDY_DATE",
  "INVALID_SURVEY_QUESTION",
  "INVALID_TOKEN",
  "METHODOLOGY_NOT_FOUND",
  "METHODOLOGY_VERSION_NOT_FOUND",
  "METHODOLOGY_VERSION_NOT_PUBLISHED",
  "METHODOLOGY_VERSION_REQUIRED",
  "MISSING_FIELDS",
  "NCNP_REPORT_REVIEW_NOT_APPROVED",
  "NCNP_REPORT_REVIEW_NOT_DRAFT",
  "NCNP_REPORT_REVIEW_NOT_FOUND",
  "NCNP_REPORT_REVIEW_NOT_RELEASED",
  "NEED_NOT_DELETABLE",
  "NEED_NOT_EDITABLE",
  "NEED_NOT_FOUND",
  "NO_ACTIVE_CONSENT_POLICY",
  "NO_APPROVED_DOMAIN",
  "NO_FILE",
  "NO_FILES",
  "NO_STUDIES_SELECTED",
  "OPTION_NOT_FOUND",
  "ORGANIZATION_ALREADY_REGISTERED",
  "ORG_ADMIN_NOT_FOUND",
  "ORG_ALREADY_APPROVED",
  "ORG_INACTIVE",
  "ORG_NOT_FOUND",
  "OTP_ALREADY_USED",
  "OTP_CHALLENGE_NOT_FOUND",
  "OTP_EXPIRED",
  "OTP_INCORRECT",
  "OTP_NOT_VERIFIED",
  "OTP_TOO_MANY_ATTEMPTS",
  "PARENT_DOMAIN_INACTIVE",
  "PRIORITY_SCORE_NOT_FOUND",
  "QUESTION_NOT_FOUND",
  "QUESTION_NOT_PENDING",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
  "REGION_NOT_FOUND",
  "STUDY_ALREADY_ARCHIVED",
  "STUDY_NOT_ARCHIVED",
  "STUDY_NOT_FOUND",
  "SUBDOMAIN_NOT_FOUND",
  "SURVEY_HAS_NO_QUESTIONS",
  "SURVEY_LINK_EMAIL_FAILED",
  "SURVEY_LINK_EXPIRED",
  "SURVEY_LINK_LABEL_ALREADY_EXISTS",
  "SURVEY_LINK_NOT_FOUND",
  "SURVEY_NOT_APPROVED",
  "SURVEY_NOT_EDITABLE",
  "SURVEY_NOT_FOUND",
  "SURVEY_NOT_PENDING_APPROVAL",
  "SURVEY_NOT_PUBLISHED",
  "SURVEY_NOT_SUBMITTABLE",
  "SURVEY_NO_METHODOLOGY_VERSION",
  "SURVEY_RESPONSE_NOT_FOUND",
  "SYSTEM_LOG_NOT_FOUND",
  "TITLE_REQUIRED",
  "UNAUTHENTICATED",
  "UNSUPPORTED_FILE_TYPE",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "USER_NOT_INVITED",
] as const;

/**
 * Maps a caught error to a localized message: the `apiErrors.<code>` string
 * when the backend sent a known code, otherwise `fallback` (which every call
 * site already has as its own translated, context-specific message). Never
 * returns the raw `ApiError.message`.
 *
 * `tApiErrors` must be `useTranslations("apiErrors")` (or a getTranslations
 * equivalent) from the calling component.
 */
export function resolveApiErrorMessage(
  error: unknown,
  tApiErrors: (key: string) => string,
  fallback: string,
): string {
  return getApiErrorMessage(error, GLOBAL_API_ERROR_CODES, tApiErrors, fallback);
}
