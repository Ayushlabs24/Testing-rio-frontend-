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
