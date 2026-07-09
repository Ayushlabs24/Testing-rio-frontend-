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
 */
export const users: MockUser[] = [
  {
    id: "user_admin",
    organizationId: "org_demo",
    roleId: "role_org_admin",
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
    roleId: "role_research_officer",
    name: "Ryan Fernandes",
    email: "officer@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-16T09:00:00.000Z",
    createdAt: "2026-01-16T09:00:00.000Z",
  },
  {
    id: "user_reviewer",
    organizationId: "org_demo",
    roleId: "role_reviewer_approver",
    name: "John Doe",
    email: "reviewer@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-17T09:00:00.000Z",
    createdAt: "2026-01-17T09:00:00.000Z",
  },
  {
    id: "user_supervisor",
    organizationId: "org_demo",
    roleId: "role_program_supervisor",
    name: "Taylor Brooks",
    email: "supervisor@demo.org",
    password: "password123",
    status: "active",
    consentedAt: "2026-01-18T09:00:00.000Z",
    createdAt: "2026-01-18T09:00:00.000Z",
  },
];
