/**
 * RIO-NFR-016 — operational log (system_logs).
 *
 * Mirrors the backend's `src/modules/system-logs/system-logs.types.ts`.
 * Deliberately separate from `services/audit`: that is the business-event
 * governance trail (RIO-FR-007), read by NGO Admins and supervisors; this is
 * platform diagnostics, System Admin only.
 */

export type SystemLogLevel = "fatal" | "error" | "warn" | "info";

export type SystemLogCategory =
  | "http"
  | "database"
  | "auth"
  | "integration"
  | "job"
  | "startup"
  | "security"
  | "application";

/** Loudest first — the order the level filter renders in. */
export const SYSTEM_LOG_LEVELS: readonly SystemLogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
];

export const SYSTEM_LOG_CATEGORIES: readonly SystemLogCategory[] = [
  "http",
  "database",
  "auth",
  "integration",
  "job",
  "startup",
  "security",
  "application",
];

export type SystemLogWindow = "1h" | "24h" | "7d" | "30d";

export const SYSTEM_LOG_WINDOWS: readonly SystemLogWindow[] = ["1h", "24h", "7d", "30d"];

export interface SystemLogEntry {
  id: string;
  level: SystemLogLevel;
  category: SystemLogCategory;
  source: string;
  eventCode: string | null;
  message: string;
  requestId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  actor: { id: string; name: string; email: string } | null;
  http: {
    method: string | null;
    path: string | null;
    statusCode: number | null;
    durationMs: number | null;
  };
  ipAddress: string | null;
  userAgent: string | null;
  stack: string | null;
  context: Record<string, unknown> | null;
  instanceId: string | null;
  createdAt: string;
}

/** Filters the list and export endpoints share — same names as the API. */
export interface SystemLogFilters {
  level?: SystemLogLevel;
  /** "warn and above" — the common triage filter. */
  minLevel?: SystemLogLevel;
  category?: SystemLogCategory;
  source?: string;
  eventCode?: string;
  requestId?: string;
  organizationId?: string;
  actorId?: string;
  statusCode?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface SystemLogListParams extends SystemLogFilters {
  limit?: number;
  offset?: number;
}

export interface SystemLogListResult {
  items: SystemLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface SystemLogSummary {
  since: string;
  window: SystemLogWindow;
  stats: {
    total: number;
    fatal: number;
    error: number;
    warn: number;
    info: number;
    failedRequests: number;
    slowRequests: number;
  };
  byCategory: Array<{ category: SystemLogCategory; count: number }>;
  topEventCodes: Array<{
    eventCode: string;
    count: number;
    lastSeenAt: string;
    sampleMessage: string;
  }>;
  errorTrend: Array<{ hour: string; count: number }>;
}
