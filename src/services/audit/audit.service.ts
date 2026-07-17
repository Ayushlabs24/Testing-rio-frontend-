import { auditEvents } from "@/mocks/data/audit";
import { findUserById } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId } from "@/mocks/utils";
import { apiClient } from "@/services/api/client";
import { apiConfig } from "@/services/api/config";
import { endpoints } from "@/services/api/endpoints";
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
 * `record()` stays mock-only: the real backend writes its own audit_logs row
 * server-side, right inside each mutating endpoint (see
 * Project-RIO-Backend's AuditService.record()) — there's no client-callable
 * "record an event" endpoint, by design, since a client-supplied audit entry
 * couldn't be trusted anyway. Every frontend service that mutates data now
 * calls the real backend, so nothing in the app currently calls this method
 * — `list()` below reads from the real API, not this mock store, so
 * anything recorded here would be invisible anyway. Kept only because
 * deleting it would also mean deleting its own unit test coverage for no
 * functional gain; it's a candidate for removal in a future pass.
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

  /** Read-only history for the current user's organisation, newest first. */
  async list(): Promise<AuditEvent[]> {
    return apiClient.get<AuditEvent[]>(endpoints.audit.list);
  },

  /**
   * CSV export (real, not a placeholder stub — audit rows are plain text
   * and don't need PDF/Excel rendering to be useful). Bypasses apiClient
   * (JSON-only) the same way reportsService.download() does, and triggers
   * a real browser download from the response.
   */
  async downloadCsv(): Promise<void> {
    const url = new URL(
      endpoints.audit.export.replace(/^\//, ""),
      `${apiConfig.baseUrl}/`,
    );
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => undefined);
      throw new ApiError({
        message: payload?.error?.message ?? response.statusText,
        status: response.status,
      });
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/.exec(disposition);
    const filename = filenameMatch?.[1] ?? "audit-log.csv";

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
