"use client";

import {
  Terminal,
  Search,
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/common/page-container";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SYSTEM_LOGS_PAGE_SIZE } from "@/config/pagination";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { Organization } from "@/services/organizations/organizations.types";
import { systemLogsService } from "@/services/system-logs/system-logs.service";
import {
  SYSTEM_LOG_CATEGORIES,
  SYSTEM_LOG_LEVELS,
  SYSTEM_LOG_WINDOWS,
  type SystemLogEntry,
  type SystemLogSummary,
  type SystemLogWindow,
} from "@/services/system-logs/system-logs.types";
import { SystemLogDetailDrawer } from "./_components/system-log-detail-drawer";
import { SystemLogExportDialog } from "./_components/system-log-export-dialog";
import {
  ALL,
  WARN_AND_ABOVE,
  buildSystemLogFilters,
} from "./_components/system-log-filter-utils";
import { SystemLogLevelBadge } from "./_components/system-log-level-badge";

const PAGE_SIZE = SYSTEM_LOGS_PAGE_SIZE;
/** Matches SYSTEM_LOG_RETENTION_DAYS' default on the API. */
const RETENTION_DAYS = 90;

/**
 * RIO-NFR-016 — System Logs.
 *
 * Deliberately a sibling of /system-admin/audit-log rather than a tab inside
 * it: different data (system errors vs business decisions), different
 * permission (`systemLogs`, System Admin only), different retention, and a
 * different question being asked. The cross-link in the header exists so
 * someone who landed here looking for the governance trail can find it.
 */
export default function SystemLogsPage() {
  const t = useTranslations("systemAdmin.systemLogs");

  const [items, setItems] = useState<SystemLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [levelFilter, setLevelFilter] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [organizationId, setOrganizationId] = useState<string>(ALL);
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [summary, setSummary] = useState<SystemLogSummary | null>(null);
  const [windowRange, setWindowRange] = useState<SystemLogWindow>("24h");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Guards against a slow earlier response overwriting a newer one when
  // filters change quickly — same pattern the Audit Log page uses.
  const requestRef = useRef(0);

  const selection = useMemo(
    () => ({ levelFilter, category, organizationId, eventCode, search }),
    [levelFilter, category, organizationId, eventCode, search],
  );

  const filters = useMemo(() => buildSystemLogFilters(selection), [selection]);

  // No synchronous setState here (and none in the effect that calls it):
  // state is only written from the promise callbacks, which is what keeps
  // this off React's cascading-render path — same shape as the Audit Log
  // page's loader. The trade-off is that a filter change keeps showing the
  // previous page for a beat instead of flashing a spinner.
  const loadLogs = useCallback(() => {
    const requestId = ++requestRef.current;
    systemLogsService
      .list({ ...filters, limit: PAGE_SIZE, offset })
      .then((res) => {
        if (requestId !== requestRef.current) return;
        setItems(res?.items ?? []);
        setTotal(res?.total ?? 0);
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== requestRef.current) return;
        setItems([]);
        setTotal(0);
        setFailed(true);
        setLoading(false);
      });
  }, [filters, offset]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    organizationsService
      .listAll()
      .then((orgs) => setOrganizations(orgs as unknown as Organization[]))
      .catch(() => setOrganizations([]));
  }, []);

  useEffect(() => {
    let active = true;
    systemLogsService
      .getSummary(windowRange)
      .then((res) => {
        if (active) setSummary(res);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => {
      active = false;
    };
  }, [windowRange]);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  // Any filter change invalidates the current page number.
  const resetTo =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setOffset(0);
    };

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Terminal className="text-primary size-6" />
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Link
                  href="/system-admin/audit-log"
                  className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                >
                  <ScrollText className="size-3.5" />
                  {t("auditLogLink")}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {t("retentionNotice", { days: RETENTION_DAYS })}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Select
                value={windowRange}
                onValueChange={(v) => setWindowRange(v as SystemLogWindow)}
              >
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder={t("filterWindow")} />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_LOG_WINDOWS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {t(`windows.${w}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["total", summary?.stats.total],
                  ["fatal", summary?.stats.fatal],
                  ["error", summary?.stats.error],
                  ["warn", summary?.stats.warn],
                  ["failedRequests", summary?.stats.failedRequests],
                  ["slowRequests", summary?.stats.slowRequests],
                ] as const
              ).map(([key, value]) => (
                <Card key={key} className="p-3 text-center">
                  <span className="text-muted-foreground text-[11px]">
                    {t(`stats.${key}`)}
                  </span>
                  <p className="text-foreground mt-1 font-mono text-lg font-bold">
                    {value ?? 0}
                  </p>
                </Card>
              ))}
            </div>

            {/* Top failures — what turns a log dump into triage. Clicking one
                filters the table to just that failure. */}
            <Card className="p-3">
              <span className="text-muted-foreground text-[11px]">
                {t("topFailures.title")}
              </span>
              {!summary || summary.topEventCodes.length === 0 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  {t("topFailures.empty")}
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {summary.topEventCodes.map((failure) => (
                    <li key={failure.eventCode}>
                      <button
                        type="button"
                        onClick={() => {
                          setEventCode(failure.eventCode);
                          setOffset(0);
                        }}
                        className="hover:bg-muted flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left"
                      >
                        <span className="text-foreground font-mono text-xs">
                          {failure.eventCode}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {failure.sampleMessage}
                        </span>
                        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                          {t("topFailures.occurrences", { count: failure.count })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Select value={levelFilter} onValueChange={resetTo(setLevelFilter)}>
                  <SelectTrigger className="w-44 text-xs">
                    <SelectValue placeholder={t("filterLevel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("allLevels")}</SelectItem>
                    <SelectItem value={WARN_AND_ABOVE}>{t("warnAndAbove")}</SelectItem>
                    {SYSTEM_LOG_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {t(`levels.${level}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={category} onValueChange={resetTo(setCategory)}>
                  <SelectTrigger className="w-40 text-xs">
                    <SelectValue placeholder={t("filterCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
                    {SYSTEM_LOG_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`categories.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={organizationId} onValueChange={resetTo(setOrganizationId)}>
                  <SelectTrigger className="w-48 text-xs">
                    <SelectValue placeholder={t("filterOrganization")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("allOrganizations")}</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sits with the filters, not in the header: the export is a
                    function of the filter bar, so it belongs next to it. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportOpen(true)}
                  className="gap-1 text-xs"
                >
                  <Download className="size-3.5" />
                  {t("actions.exportCsv")}
                </Button>

                {eventCode && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1 font-mono text-[11px]"
                    onClick={() => {
                      setEventCode(null);
                      setOffset(0);
                    }}
                  >
                    {eventCode} ✕
                  </Button>
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOffset(0);
                  }}
                  className="pl-9 text-xs"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.timestamp")}</TableHead>
                    <TableHead>{t("columns.level")}</TableHead>
                    <TableHead>{t("columns.category")}</TableHead>
                    <TableHead>{t("columns.source")}</TableHead>
                    <TableHead>{t("columns.message")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.duration")}</TableHead>
                    <TableHead>{t("columns.organization")}</TableHead>
                    <TableHead className="text-right">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <div className="flex justify-center">
                          <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-muted-foreground h-24 text-center"
                      >
                        {failed ? t("loadFailed") : t("noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <SystemLogLevelBadge level={item.level} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {t(`categories.${item.category}`)}
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-xs">
                          {item.source}
                        </TableCell>
                        <TableCell className="max-w-md text-xs">
                          <span className="text-foreground block break-words whitespace-normal">
                            {item.message}
                          </span>
                          {item.eventCode && (
                            <span className="text-muted-foreground block font-mono text-[10px]">
                              {item.eventCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {item.http.statusCode ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {item.http.durationMs !== null
                            ? `${item.http.durationMs}ms`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {item.organizationName ?? t("globalScope")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => setInspectId(item.id)}
                          >
                            <Eye className="size-3.5" />
                            {t("actions.viewDetails")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="border-border flex items-center justify-between border-t px-4 py-3 text-xs">
                <span className="text-muted-foreground font-mono">
                  {t("paginationShowing", {
                    start: total === 0 ? 0 : offset + 1,
                    end: Math.min(offset + PAGE_SIZE, total),
                    total,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    {t("previous")}
                  </Button>
                  <span className="text-muted-foreground font-mono">
                    {t("paginationPage", { current: currentPage, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    {t("next")}
                    <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mounted only while open so the dialog seeds its draft from the
            filters in force at that moment. */}
        {exportOpen && (
          <SystemLogExportDialog
            open
            onOpenChange={setExportOpen}
            selection={selection}
            organizations={organizations}
          />
        )}

        <SystemLogDetailDrawer
          entryId={inspectId}
          open={!!inspectId}
          onClose={() => setInspectId(null)}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
