import { auditEvents } from "@/mocks/data/audit";
import { findUserById } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId, mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import type { AuditEvent, RecordAuditEventInput } from "@/services/audit/audit.types";

function requireCurrentUser() {
  const session = mockSession.read();
  const user = session ? findUserById(session.userId) : undefined;
  if (!user) {
    throw new ApiError({ message: "Not authenticated.", status: 401 });
  }
  return user;
}

/**
 * Returns a mutable, defensive copy of a stored event. Every nested structure
 * (actor, changes, metadata) is copied too — a shallow spread would leave the
 * returned event sharing the store's `changes`/`metadata` references, letting a
 * caller reach in and rewrite append-only history through `list()`.
 */
function clone(event: AuditEvent): AuditEvent {
  return {
    ...event,
    actor: event.actor ? { ...event.actor } : null,
    changes: event.changes?.map((change) => ({ ...change })),
    metadata: event.metadata ? { ...event.metadata } : undefined,
  };
}

/**
 * Mock implementation with the exact call signatures a backend-backed audit
 * service would have. Swapping in a real API later means rewriting the inside
 * of these methods to call `apiClient`; nothing outside this file changes.
 */
export const auditService = {
  /**
   * Append one immutable event to the log, attributed to the current actor
   * with a fresh timestamp. Called synchronously from other services right
   * after a mutating action succeeds. The stored event (and its actor) is
   * frozen so recorded history can never be rewritten.
   */
  record(input: RecordAuditEventInput): AuditEvent {
    const user = requireCurrentUser();
    const event: AuditEvent = Object.freeze({
      id: generateId("audit"),
      organizationId: user.organizationId,
      actor: Object.freeze({ id: user.id, name: user.name, email: user.email }),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      changes: input.changes
        ? (Object.freeze(
            input.changes.map((change) => Object.freeze({ ...change })),
          ) as AuditEvent["changes"])
        : undefined,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
      // ip_address / user_agent are captured server-side from the request; the
      // mock layer has no request context, so they stay null here.
      ipAddress: null,
      userAgent: null,
      createdAt: new Date().toISOString(),
    });
    auditEvents.push(event);
    return event;
  },

  /**
   * Read-only history for the current user's organisation, newest first.
   * Returns defensive copies so callers can never reach into and mutate the
   * append-only store.
   */
  async list(): Promise<AuditEvent[]> {
    await mockDelay();
    const user = requireCurrentUser();
    return auditEvents
      .filter((event) => event.organizationId === user.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  },
};
