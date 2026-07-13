import type { Sector } from "@/config/sectors";

export interface Organization {
  id: string;
  name: string;
  /** Captured at signup; not yet editable from the organization profile screen. */
  purpose: string;
  /**
   * The org's unique registration number — captured at signup and used to
   * block a duplicate signup for the same NGO. Verification against a
   * government registry (or OTP/Aadhaar) is future work; for now it's just
   * stored and checked for uniqueness (see `authService.signup()`).
   */
  registrationNumber: string;
  logoUrl: string | null;
  region: string;
  email: string;
  sector: Sector | null;
  villages: string[];
  isActive: boolean;
  createdAt: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  logoUrl?: string | null;
  region?: string;
  email?: string;
  sector?: Sector | null;
  villages?: string[];
  isActive?: boolean;
}

export interface OrganizationSummary extends Organization {
  memberCount: number;
}

/**
 * System Admin creates an org and its first NGO Admin together, in one
 * action. Dormant while System Admin is disabled (see roles.ts) — public
 * signup (`authService.signup()`) is the only reachable path to a new
 * organization right now, but this type still needs `purpose`/
 * `registrationNumber` so `Organization` stays consistently required.
 */
export interface CreateOrganizationPayload {
  name: string;
  purpose: string;
  registrationNumber: string;
  region: string;
  email: string;
  sector: Sector | null;
  villages: string[];
  adminName: string;
  adminEmail: string;
}
