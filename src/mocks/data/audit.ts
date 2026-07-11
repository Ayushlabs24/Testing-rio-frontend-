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
    // Freeze the changes array and each entry, mirroring auditService.record —
    // seeded history must be exactly as immutable as recorded history.
    changes: event.changes
      ? (Object.freeze(
          event.changes.map((change) => Object.freeze({ ...change })),
        ) as AuditEvent["changes"])
      : event.changes,
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
    changes: [{ field: "Name", before: null, after: "Demo Nonprofit Alliance" }],
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
    changes: [
      { field: "Name", before: null, after: "Ryan Fernandes" },
      { field: "Email", before: null, after: "officer@demo.org" },
      { field: "Role", before: null, after: "Field Officer" },
    ],
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
    changes: [
      { field: "Name", before: null, after: "John Doe" },
      { field: "Email", before: null, after: "reviewer@demo.org" },
      { field: "Role", before: null, after: "Reviewer" },
    ],
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
    changes: [
      { field: "Name", before: null, after: "Taylor Brooks" },
      { field: "Email", before: null, after: "supervisor@demo.org" },
      { field: "Role", before: null, after: "Supervisor" },
    ],
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-18T09:00:00.000Z",
  }),
  seed({
    id: "audit_seed_5",
    organizationId: "org_demo",
    actor: demoAdminActor,
    action: "edit",
    entityType: "user",
    entityId: "user_reviewer",
    entityLabel: "John Doe",
    changes: [
      { field: "Role", before: "Reviewer", after: "Supervisor" },
      { field: "Status", before: "invited", after: "active" },
    ],
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-20T14:30:00.000Z",
  }),
  seed({
    id: "audit_seed_6",
    organizationId: "org_demo",
    actor: demoAdminActor,
    action: "edit",
    entityType: "organization",
    entityId: "org_demo",
    entityLabel: "Demo Nonprofit Alliance",
    changes: [
      { field: "Region", before: "Northern", after: "Northern & Eastern" },
      { field: "Villages", before: "Maple, Oak", after: "Maple, Oak, Birch" },
    ],
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-01-22T11:15:00.000Z",
  }),
];
