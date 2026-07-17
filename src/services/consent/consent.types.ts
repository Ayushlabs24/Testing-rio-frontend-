export interface ActiveConsentPolicy {
  version: string;
  text: string;
}

/** Read-only — the org's latest accepted policy version, for the
 * Organization Settings Consent card. All fields null if nobody has
 * consented yet under the current policy scheme. */
export interface OrganizationConsentStatus {
  version: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
}
