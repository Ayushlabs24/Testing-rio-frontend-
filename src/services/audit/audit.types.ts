import type { AuditAction, AuditEntityType } from "@/config/audit";

/**
 * A single field's before/after values for an audited change. Captured at the
 * moment the action happened so the log shows exactly what a record looked like
 * before and after — the "before/after values" required by the audit trail.
 * `before` is null for created records, `after` is null for deleted ones.
 * Persisted inside `audit_logs.metadata` (JSONB) alongside the rest of the
 * event context.
 */
export interface AuditFieldChange {
  /** Human-readable field name, already localised/denormalised for display. */
  field: string;
  before: string | null;
  after: string | null;
}

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
  /**
   * Field-level before/after values for this event, in display order. Present
   * on edits (and optionally on create/delete). Denormalised for display and
   * persisted inside `audit_logs.metadata`.
   */
  changes?: AuditFieldChange[];
  /** Free-form context bag — maps to `audit_logs.metadata` (JSONB). */
  metadata?: Record<string, unknown>;
  /**
   * The entity's own external tracking id (e.g. a Need's `referenceId` — a
   * field form number or partner org's case id) — a first-class, indexed
   * column on `audit_logs.source_ref`, not another metadata key. Null (or
   * absent, from the mock-only record() path — see its own comment) for
   * events whose entity has no such reference.
   */
  sourceRef?: string | null;
  /** Captured server-side; maps to `audit_logs.ip_address`. */
  ipAddress?: string | null;
  /** Captured server-side; maps to `audit_logs.user_agent`. */
  userAgent?: string | null;
  /** ISO-8601 UTC timestamp — the immutable date stamp (`audit_logs.created_at`). */
  createdAt: string;
}

/**
 * Query params accepted by `GET /audit/export` (a subset of the ones the
 * list endpoint takes — the ones the Audit Log page actually exposes).
 * `dateFrom`/`dateTo` are ISO-8601 instants, inclusive on both ends.
 */
export interface AuditExportFilters {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Matches the entity label or the actor's name/email, case-insensitively. */
  search?: string;
}

/** The same filters, plus paging — `GET /audit`. Server caps `limit` at 200. */
export interface AuditListParams extends AuditExportFilters {
  limit?: number;
  offset?: number;
}

/** Paginated envelope from `GET /audit`. `total` ignores limit/offset. */
export interface AuditListResult {
  items: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
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
  /** Field-level before/after values to record for this event. */
  changes?: AuditFieldChange[];
  metadata?: Record<string, unknown>;
}
