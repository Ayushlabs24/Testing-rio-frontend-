import type { PermissionModule } from "@/types/permissions";

/**
 * Universal, single source of truth for the audit-log vocabulary. Every
 * audit event references an action and an entity type from these lists —
 * never a free-form string — so the log stays consistent everywhere in the
 * app. This mirrors how `config/sectors.ts` and `types/permissions.ts`
 * centralise their fixed vocabularies.
 *
 * Maps to the `audit_logs` table (see the ER diagram): frontend `action` →
 * `audit_logs.action`, `entityType` → `entity_type`, `entityId` →
 * `entity_id`. The DB stores those columns as free VARCHAR; keeping the set
 * closed here is a deliberate app-side guardrail. Add an entry here (and its
 * label in messages/en.json under app.settings.audit.actions / .entities) to
 * make a new kind of event auditable across the whole app.
 */

/**
 * The key lifecycle events tracked in the audit log. `create/edit/approve/
 * share` are the governed actions called out in scope.md (approve ↔ the
 * `approvals` table, share ↔ the `sharing_requests` flow); `delete` is
 * included so destructive removals are never silently lost.
 */
export const AUDIT_ACTIONS = ["create", "edit", "approve", "share", "delete"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * The kinds of records an audit event can be about — one per governed entity
 * in the schema. `study` carries the community need statement (scope.md's
 * needs → survey → evidence → report loop); `evidence` covers uploaded
 * documents and their extracted key points; `sharing_request` backs the
 * cross-organisation share flow.
 */
export const AUDIT_ENTITY_TYPES = [
  "organization",
  "user",
  "study",
  "survey",
  "evidence",
  "report",
  "sharing_request",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * Which permission module governs each entity type. Keeps audit entries
 * aligned with the RBAC matrix in `mocks/data/roles.ts` — the single place
 * that decides who may act on (and therefore appear in the log for) an entity.
 */
export const AUDIT_ENTITY_MODULE: Record<AuditEntityType, PermissionModule> = {
  organization: "entityTeam",
  user: "entityTeam",
  study: "studySurvey",
  survey: "studySurvey",
  evidence: "dataCollection",
  report: "reportsDashboards",
  sharing_request: "archiveSharingAudit",
};
