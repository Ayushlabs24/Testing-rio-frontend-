import { auditEvents } from "@/mocks/data/audit";
import { findUserById } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId } from "@/mocks/utils";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type {
  AuditEvent,
  AuditExportFilters,
  AuditListParams,
  AuditListResult,
  RecordAuditEventInput,
} from "@/services/audit/audit.types";

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

  /**
   * Read-only history for the current user's organisation, newest first.
   * Filtering and pagination are the server's job — the log is unbounded and
   * the endpoint caps a single page at 200 rows, so filtering a client-side
   * array would only ever search the most recent page.
   */
  async list(params: AuditListParams = {}): Promise<AuditListResult> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const qs = search.toString();
    return apiClient.get<AuditListResult>(
      qs ? `${endpoints.audit.list}?${qs}` : endpoints.audit.list,
    );
  },

  /**
   * CSV export (real, not a placeholder stub — audit rows are plain text
   * and don't need PDF/Excel rendering to be useful). Goes through
   * apiClient.download (blob handling, not response.json()), the same way
   * reportsService.download() does.
   */
  async downloadCsv(filters: AuditExportFilters = {}): Promise<void> {
    // Mirrors the Audit Log page's own filters so the CSV contains exactly
    // the rows the user is looking at — an export that quietly ignored the
    // active filters would be worse than no export at all. Falsy values
    // (including "") are dropped, same as the old manual param loop.
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value) params[key] = value;
    }

    const { blob, filename } = await apiClient.download(
      endpoints.audit.export,
      "audit-log.csv",
      { params },
    );

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
