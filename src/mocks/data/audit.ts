import type { AuditEvent } from "@/services/audit/audit.types";

/**
 * Append-only, in-memory audit log — the mock stand-in for the `audit_logs`
 * table.
 *
 * Seeded with the demo organisation's earliest lifecycle events — its
 * creation and the first users being added — so history reaches back to day
 * one. This is the whole point of the feature: the audit capability is
 * treated as having existed *before* any action, so early history is never
 * lost (scope: "Must capture events before those actions exist").
 *
 * Only `src/services/audit/audit.service.ts` may touch this array, and it
 * only ever appends. Each entry (and its nested actor) is frozen on insert so
 * nothing downstream can rewrite recorded history.
 */

const demoAdminActor = Object.freeze({
  id: "user_admin",
  name: "Alex Morgan",
  email: "admin@demo.org",
});

function seed(event: AuditEvent): AuditEvent {
  return Object.freeze({
    ...event,
    actor: event.actor ? Object.freeze({ ...event.actor }) : null,
  });
}

export const auditEvents: AuditEvent[] = [
  seed({
    id: "audit_seed_1",
    organizationId: "org_demo",
    actor: demoAdminActor,
    action: "create",
    entityType: "organization",
    entityId: "org_demo",
    entityLabel: "Demo Nonprofit Alliance",
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-15T09:00:00.000Z",
  }),
  seed({
    id: "audit_seed_2",
    organizationId: "org_demo",
    actor: demoAdminActor,
    action: "create",
    entityType: "user",
    entityId: "user_officer",
    entityLabel: "Ryan Fernandes",
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-16T09:00:00.000Z",
  }),
  seed({
    id: "audit_seed_3",
    organizationId: "org_demo",
    actor: demoAdminActor,
    action: "create",
    entityType: "user",
    entityId: "user_reviewer",
    entityLabel: "John Doe",
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-17T09:00:00.000Z",
  }),
  seed({
    id: "audit_seed_4",
    organizationId: "org_demo",
    actor: demoAdminActor,
    action: "create",
    entityType: "user",
    entityId: "user_supervisor",
    entityLabel: "Taylor Brooks",
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-18T09:00:00.000Z",
  }),
];
