/**
 * RIO-DATA-001 — the two separately-versioned consents. `use_policy` is the
 * acceptance of the platform's terms of use; `data_sharing` is the distinct
 * consent to share the organisation's data. They version independently, so an
 * org can be current on one and stale on the other.
 */
export type ConsentKind = "use_policy" | "data_sharing" | "citizen_consent";

/**
 * The languages a consent can be read in — the subset of `routing.locales`
 * the backend holds policy copy for. Kept as its own type rather than reusing
 * `AppLocale` so adding a UI language does not silently imply the policies
 * were translated too.
 */
export type ConsentLocale = "en" | "ar";

export interface ActiveConsentPolicy {
  kind: ConsentKind;
  version: string;
  text: string;
  /**
   * The same version's Arabic wording, or null when the translation is still
   * outstanding. Both languages arrive in one payload so switching language
   * re-renders an open policy dialog instantly — no refetch, and no blank
   * body mid-read.
   */
  textAr: string | null;
}

/**
 * The wording to show a reader of `locale`, falling back to English when the
 * Arabic copy is missing: an untranslated policy is a content gap, but a
 * blank consent is a broken registration.
 *
 * Presentation only — the server independently re-derives the same text from
 * the submitted locale before snapshotting it (see the backend's
 * `consentPolicyTextFor`), so this never decides what gets recorded.
 */
export function consentPolicyTextFor(
  policy: Pick<ActiveConsentPolicy, "text" | "textAr">,
  locale: ConsentLocale,
): string {
  return locale === "ar" && policy.textAr ? policy.textAr : policy.text;
}

/** Both active policies, as returned by GET /consent-policy/active. */
export interface ActiveConsentPolicies {
  usePolicy: ActiveConsentPolicy;
  dataSharing: ActiveConsentPolicy;
}

/** One consent's acceptance state; nulls when that consent is outstanding. */
export interface ConsentAcceptanceStatus {
  version: string | null;
  acceptedAt: string | null;
}

/** Read-only — each consent's accepted version/date for the Organization
 * Settings Consent card, plus who accepted on the org's behalf. */
export interface OrganizationConsentStatus {
  usePolicy: ConsentAcceptanceStatus;
  dataSharing: ConsentAcceptanceStatus;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
}

/**
 * What the registration form submits: the exact version each checkbox was
 * shown for, not a bare boolean. The server rejects a version that is no
 * longer active, so a form left open across a policy update fails loudly
 * instead of filing consent against text the user never read.
 */
export interface ConsentAcceptanceInput {
  usePolicyVersion: string;
  dataSharingVersion: string;
  /**
   * Which language the two policies were displayed in, sent for the same
   * reason the versions are: it pins *what* was agreed to. The server uses it
   * to snapshot the wording actually read — it never accepts the text itself
   * from the client.
   */
  locale: ConsentLocale;
}

/**
 * Where a version sits in the draft → review → publish workflow the client
 * confirmed on 2026-08-27. Mirrors the Methodology Configuration status
 * vocabulary deliberately — same governance gate, so the two admin tabs read
 * and badge alike.
 */
export type ConsentPolicyStatus = "draft" | "pending_approval" | "approved" | "published";

/**
 * One policy version as the Consent Policies tab sees it: the full row,
 * including workflow state and provenance. Distinct from
 * `ActiveConsentPolicy`, which is the anonymous signup screen's minimal view
 * of the one live version.
 */
export interface ConsentPolicyVersion {
  id: string;
  kind: ConsentKind;
  version: string;
  text: string;
  textAr: string | null;
  status: ConsentPolicyStatus;
  /** True for the one version per kind currently shown at signup. */
  active: boolean;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  publishedByName: string | null;
  publishedAt: string | null;
}

/** Every version of every kind, newest first. */
export interface ConsentPolicyVersionList {
  usePolicy: ConsentPolicyVersion[];
  dataSharing: ConsentPolicyVersion[];
  /**
   * The notice citizen respondents accept before a public survey collects
   * anything (RIO-NFR-002) — same lifecycle and same admin tab as the two
   * signup consents, but never shown at signup.
   */
  citizenConsent: ConsentPolicyVersion[];
}

export interface CreateConsentPolicyPayload {
  kind: ConsentKind;
  version: string;
  text: string;
  /** `null` clears a half-finished translation back to "not translated yet". */
  textAr?: string | null;
}

export interface UpdateConsentPolicyPayload {
  version?: string;
  text?: string;
  textAr?: string | null;
}
