import type { Sector } from "@/config/sectors";

export interface MockOrganization {
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

/**
 * Mutable in-memory store — resets on full page reload/server restart.
 * This is intentional for a mock-only phase; swap for real persistence
 * when the backend exists (see `src/services/organizations`).
 */
export const organizations: MockOrganization[] = [
  {
    id: "org_demo",
    name: "Demo Nonprofit Alliance",
    logoUrl: null,
    region: "Yorkshire, United Kingdom",
    email: "contact@demo-nonprofit-alliance.org",
    sector: "livelihoods",
    villages: ["Chipping Norton", "Stow-on-the-Wold", "Bourton-on-the-Water"],
    isActive: true,
    createdAt: "2026-01-15T09:00:00.000Z",
  },
];
