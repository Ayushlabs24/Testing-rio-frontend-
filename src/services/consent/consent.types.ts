/**
 * RIO-DATA-001 — the two separately-versioned consents. `use_policy` is the
 * acceptance of the platform's terms of use; `data_sharing` is the distinct
 * consent to share the organisation's data. They version independently, so an
 * org can be current on one and stale on the other.
 */
export type ConsentKind = "use_policy" | "data_sharing";

export interface ActiveConsentPolicy {
  kind: ConsentKind;
  version: string;
  text: string;
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
}
