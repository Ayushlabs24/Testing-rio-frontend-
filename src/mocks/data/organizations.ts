import type { Sector } from "@/config/sectors";

export interface MockOrganization {
  id: string;
  name: string;
  purpose: string;
  registrationNumber: string;
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
/**
 * Two orgs are seeded on purpose, not one: the accounts/roles/permissions
 * backbone's acceptance criteria include "cross-entity access prevented,"
 * and that can't actually be demonstrated or e2e-tested with only a single
 * organization in the data set.
 */
export const organizations: MockOrganization[] = [
  {
    id: "org_demo",
    name: "Demo Nonprofit Alliance",
    purpose: "Livelihoods and economic development across rural communities.",
    registrationNumber: "REG-DEMO-0001",
    logoUrl: null,
    region: "Yorkshire, United Kingdom",
    email: "contact@demo-nonprofit-alliance.org",
    sector: "livelihoods",
    villages: ["Chipping Norton", "Stow-on-the-Wold", "Bourton-on-the-Water"],
    isActive: true,
    createdAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "org_second",
    name: "Riverside Community Trust",
    purpose: "Water, sanitation, and hygiene access for riverside villages.",
    registrationNumber: "REG-DEMO-0002",
    logoUrl: null,
    region: "Kerala, India",
    email: "contact@riverside-community-trust.org",
    sector: "wash",
    villages: ["Munduthode", "Kalpetta", "Sultan Bathery"],
    isActive: true,
    createdAt: "2026-02-01T09:00:00.000Z",
  },
];
