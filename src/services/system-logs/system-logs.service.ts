import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  SystemLogEntry,
  SystemLogFilters,
  SystemLogListParams,
  SystemLogListResult,
  SystemLogSummary,
  SystemLogWindow,
} from "@/services/system-logs/system-logs.types";

/**
 * RIO-NFR-016 — read-only client for the operational log.
 *
 * No mock branch and no `record()` counterpart, deliberately: operational
 * rows are written server-side from inside the process (exception filter,
 * request interceptor, integrations, jobs), and a client-supplied
 * "operational event" would be neither trustworthy nor correlated to a real
 * request. Everything here reads.
 */

/** Drop undefined/empty values so `?level=` never reaches the API. */
function toParams(input: object): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = typeof value === "number" ? value : String(value);
  }
  return params;
}

export const systemLogsService = {
  /** Newest first. Filtering and pagination are the server's job — the table
   *  is unbounded and a page is capped at 200 rows. */
  async list(params: SystemLogListParams = {}): Promise<SystemLogListResult> {
    return apiClient.get<SystemLogListResult>(endpoints.systemLogs.list, {
      params: toParams(params),
    });
  },

  async getSummary(window: SystemLogWindow = "24h"): Promise<SystemLogSummary> {
    return apiClient.get<SystemLogSummary>(endpoints.systemLogs.summary, {
      params: { window },
    });
  },

  async getById(id: string): Promise<SystemLogEntry> {
    return apiClient.get<SystemLogEntry>(endpoints.systemLogs.byId(id));
  },

  /**
   * Every entry sharing one request id, oldest first — the trace behind a
   * single failed request. This is what the correlation fields stamped on
   * every log line exist for.
   */
  async getByRequestId(requestId: string): Promise<SystemLogEntry[]> {
    const res = await apiClient.get<{ items: SystemLogEntry[] }>(
      endpoints.systemLogs.byRequest(requestId),
    );
    return res?.items ?? [];
  },

  /**
   * CSV export. Mirrors the screen's active filters so the file contains
   * exactly the rows the user is looking at — an export that quietly ignored
   * the filters would be worse than no export at all.
   */
  async downloadCsv(filters: SystemLogFilters = {}): Promise<void> {
    const blob = await apiClient.downloadBlob(endpoints.systemLogs.export, {
      params: toParams(filters),
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
