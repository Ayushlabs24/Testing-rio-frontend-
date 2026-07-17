import type { Sector } from "@/config/sectors";

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
  sector: Sector | null;
  villages: string[];
  isActive: boolean;
  createdAt: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  logoUrl?: string | null;
  region?: string[];
  email?: string;
  sector?: Sector | null;
  purpose?: string | null;
  villages?: string[];
  isActive?: boolean;
}

export interface OrganizationSummary extends Organization {
  memberCount: number;
}
