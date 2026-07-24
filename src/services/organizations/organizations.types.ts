export interface Organization {
  id: string;
  name: string;
  /** Only meaningful when `sector` is `"other"` — the org's own free-text
   * description of what that is. */
  purpose: string;
  /**
   * The org's unique registration number — captured at signup and used to
   * block a duplicate signup for the same NGO. Verification against a
   * government registry (or OTP/Aadhaar) is future work; for now it's just
   * stored and checked for uniqueness (see `authService.signup()`).
   */
  registrationNumber: string;
  logoUrl: string | null;
  region: string[];
  email: string;
  /** A live Methodology Configuration domain name (e.g. "Health"), or
   * "other" (paired with `purpose` for free text) — never a fixed enum. */
  sector: string | null;
  villages: string[];
  // Optional link into the KSA Geographic Reference master data
  // (Region -> Governorate -> Center) — additive alongside the free-text
  // `region`/`villages` above, not a replacement for them. An org has
  // exactly *one* Region (single-select), but can span *many*
  // Governorates and *many* Centers (both many-to-many).
  regionId: string | null;
  governorateIds: string[];
  centerIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  logoUrl?: string | null;
  region?: string[];
  email?: string;
  sector?: string | null;
  purpose?: string | null;
  villages?: string[];
  regionId?: string | null;
  // Replaces the *entire* set when provided (not a merge/append).
  governorateIds?: string[];
  centerIds?: string[];
  isActive?: boolean;
}

export interface OrganizationSummary extends Organization {
  memberCount: number;
}
