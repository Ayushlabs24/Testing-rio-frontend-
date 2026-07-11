import type { UserStatus } from "@/services/users/users.types";

export interface MockUser {
  id: string;
  organizationId: string;
  roleId: string;
  name: string;
  email: string;
  /** Mock-only plaintext password check — never do this against a real backend. */
  password: string;
  status: UserStatus;
  /**
   * When this user accepted the data-sharing consent notice. `null` means
   * they haven't yet — true for anyone an admin invited via the Users page,
   * since only the person themselves can consent, not whoever created the
   * account. Self-signups get this set immediately (see auth.service.ts).
   */
  consentedAt: string | null;
  createdAt: string;
}

/**
 * Mutable in-memory store, seeded with one demo user per role so every role
 * can be logged in and inspected immediately. All seed accounts share the
 * password `password123`.
 *
 * Seeded across both `org_demo` and `org_second` on purpose, so cross-entity
 * separation is actually observable: log in as `admin@demo.org` and
 * `admin@riverside.org` and the Users page shows two disjoint lists.
 *
 * System Admin and Center Supervisor aren't organization-scoped roles per
 * `new scope.md` (System Admin is platform-administrative; Center
 * Supervisor is cross-entity read/follow). They're attached to `org_demo`
 * here only because `MockUser.organizationId` is required in this mock
 * model — a real implementation would make that field optional for these
 * two roles rather than pin them to one entity.
 *
 * Citizen/Beneficiary Guest has no seed account here: it's a public,
 * unauthenticated data source in the document, not a login. Nothing in
 * this phase's login form should ever expect a Citizen Guest credential.
 */
export const users: MockUser[] = [
  {
    id: "user_admin",
    organizationId: "org_demo",
    roleId: "role_ngo_admin",
    name: "Alex Morgan",
    email: "admin@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-15T09:00:00.000Z",
    createdAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "user_officer",
    organizationId: "org_demo",
    roleId: "role_ngo_research_officer",
    name: "Ryan Fernandes",
    email: "officer@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-16T09:00:00.000Z",
    createdAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: "user_field_researcher",
    organizationId: "org_demo",
    roleId: "role_field_researcher",
    name: "Grace Okoro",
    email: "field@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-16T12:00:00.000Z",
    createdAt: "2026-01-16T12:00:00.000Z",
  },
  {
    id: "user_reviewer",
    organizationId: "org_demo",
    roleId: "role_human_reviewer",
    name: "John Doe",
    email: "reviewer@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-17T09:00:00.000Z",
    createdAt: "2026-01-17T09:00:00.000Z",
  },
  {
    id: "user_analyst",
    organizationId: "org_demo",
    roleId: "role_data_analyst",
    name: "Priya Nair",
    email: "analyst@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-17T12:00:00.000Z",
    createdAt: "2026-01-17T12:00:00.000Z",
  },
  {
    id: "user_system_admin",
    organizationId: "org_demo",
    roleId: "role_system_admin",
    name: "Morgan Lee",
    email: "sysadmin@rio.platform",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-15T09:00:00.000Z",
    createdAt: "2026-01-15T09:00:00.000Z",
  },
  {
    id: "user_viewer",
    organizationId: "org_demo",
    roleId: "role_read_only_viewer",
    name: "Sam Whitfield",
    email: "viewer@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-18T09:00:00.000Z",
    createdAt: "2026-01-18T09:00:00.000Z",
  },
  {
    id: "user_supervisor",
    organizationId: "org_demo",
    roleId: "role_center_supervisor",
    name: "Taylor Brooks",
    email: "supervisor@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-18T09:00:00.000Z",
    createdAt: "2026-01-18T09:00:00.000Z",
  },
  {
    id: "user_admin_second",
    organizationId: "org_second",
    roleId: "role_ngo_admin",
    name: "Devika Menon",
    email: "admin@riverside.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-02-01T09:00:00.000Z",
    createdAt: "2026-02-01T09:00:00.000Z",
  },
  {
    id: "user_officer_second",
    organizationId: "org_second",
    roleId: "role_ngo_research_officer",
    name: "Arun Pillai",
    email: "officer@riverside.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-02-02T09:00:00.000Z",
    createdAt: "2026-02-02T09:00:00.000Z",
  },
];
