import type { AuditAction, AuditEntityType } from "@/config/audit";

/**
 * Who performed an audited action, captured at the moment it happened.
 * Snapshotted into the log (not just referenced by id) so history survives
 * the user later being renamed or deleted — `audit_logs.user_id` has no
 * cascade delete, and the DB stores this snapshot in `audit_logs.metadata`.
 */
export interface AuditActor {
  id: string;
  name: string;
  email: string;
}

/**
 * One immutable entry in the audit log — the read model returned by the list
 * endpoint, joined/denormalised for display. Maps to a row of `audit_logs`:
 * `actor` ↔ `user_id` (+ metadata snapshot), `entityType` ↔ `entity_type`,
 * `entityId` ↔ `entity_id`, `createdAt` ↔ `created_at`. Once recorded,
 * nothing in the app edits or deletes it — the log is append-only.
 */
export interface AuditEvent {
  id: string;
  /** Maps to `audit_logs.organisation_id`. Null for system/cross-org events. */
  organizationId: string | null;
  /** Maps to `audit_logs.user_id`. Null when the actor is the system, not a user. */
  actor: AuditActor | null;
  action: AuditAction;
  entityType: AuditEntityType;
  /** Id of the specific record the action touched (e.g. the user's id). */
  entityId: string | null;
  /**
   * Human-readable label for the entity as it was at the time of the event.
   * Denormalised for display; persisted inside `audit_logs.metadata`.
   */
  entityLabel: string;
  /** Free-form context bag — maps to `audit_logs.metadata` (JSONB). */
  metadata?: Record<string, unknown>;
  /** Captured server-side; maps to `audit_logs.ip_address`. */
  ipAddress?: string | null;
  /** Captured server-side; maps to `audit_logs.user_agent`. */
  userAgent?: string | null;
  /** ISO-8601 UTC timestamp — the immutable date stamp (`audit_logs.created_at`). */
  createdAt: string;
}

/**
 * Everything a caller supplies to record an event. The log fills in the id,
 * organisation, actor, timestamp, and request context itself so those can't
 * be spoofed.
 */
export interface RecordAuditEventInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  metadata?: Record<string, unknown>;
}
