import type { Sector } from "@/config/sectors";

export interface Organization {
  id: string;
  name: string;
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

/** System Admin creates an org and its first NGO Admin together, in one action. */
export interface CreateOrganizationPayload {
  name: string;
  region: string;
  email: string;
  sector: Sector | null;
  villages: string[];
  adminName: string;
  adminEmail: string;
}
