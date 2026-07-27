"use client";

import { Download, History, Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermission } from "@/hooks/use-permission";
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
import { AUDIT_ACTIONS, type AuditAction } from "@/config/audit";
import { AUDIT_PAGE_SIZE } from "@/config/pagination";
import { auditService } from "@/services/audit/audit.service";
import type { AuditEvent, AuditListParams } from "@/services/audit/audit.types";
import { ChangeDetailsDialog } from "./change-details-dialog";

/** Badge tone per action — keeps destructive/approval events visually distinct. */
const ACTION_VARIANT: Record<
  AuditAction,
  "default" | "secondary" | "outline" | "destructive"
> = {
  create: "secondary",
  edit: "outline",
  approve: "default",
  share: "default",
  delete: "destructive",
  login: "outline",
  logout: "outline",
  consent: "secondary",
};

const ALL = "all";
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Quick date presets, plus `custom` which reveals the from/to inputs. The
 * rolling options ("last 30 days") are deliberately relative to *now*, not
 * to calendar boundaries — "this month" and "this year" cover the calendar
 * cases.
 */
const DATE_PRESETS = [
  "all",
  "last7Days",
  "last30Days",
  "thisMonth",
  "thisYear",
  "custom",
] as const;
type DatePreset = (typeof DATE_PRESETS)[number];

/** Local midnight `n` days back, so "last 7 days" includes all of today. */
function daysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Resolves a preset (or the custom from/to pair) to an inclusive
 * [start, end] instant range. `null` on either side means unbounded.
 * Custom dates come from `<input type="date">` as `yyyy-mm-dd`, parsed as
 * *local* dates so the range matches what the user sees in the Date column
 * (which renders in their locale/timezone), not UTC.
 */
function resolveDateRange(
  preset: DatePreset,
  from: string,
  to: string,
): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (preset) {
    case "last7Days":
      return { start: daysAgo(6), end: null };
    case "last30Days":
      return { start: daysAgo(29), end: null };
    case "thisMonth":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case "thisYear":
      return { start: new Date(now.getFullYear(), 0, 1), end: null };
    case "custom": {
      const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
      const [toYear, toMonth, toDay] = to.split("-").map(Number);
      return {
        start: from ? new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0) : null,
        // End of the chosen day — a "to" of the 5th must include the 5th.
        end: to ? new Date(toYear, toMonth - 1, toDay, 23, 59, 59, 999) : null,
      };
    }
    default:
      return { start: null, end: null };
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** A fetched page, tagged with the request object that produced it. */
interface LoadedPage {
  request: AuditListParams;
  items: AuditEvent[];
  total: number;
}

export default function AuditSettingsPage() {
  const t = useTranslations("app.settings.audit");
  const tActions = useTranslations("app.settings.audit.actions");
  const tEntities = useTranslations("app.settings.audit.entities");
  const tDatePresets = useTranslations("app.settings.audit.datePresets");
  const canExport = usePermission("archiveSharingAudit", "export");
  // Results are stamped with the request that produced them, so "is this
  // stale?" is derived rather than tracked in a separate loading flag that
  // an effect would have to set.
  const [result, setResult] = useState<LoadedPage | null>(null);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<AuditAction | typeof ALL>(ALL);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(AUDIT_PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // The log is unbounded, so filtering runs server-side — the typed query is
  // debounced to keep that to one request per pause, not one per keystroke.
  const debouncedQuery = useDebouncedValue(query);

  const filters = useMemo(() => {
    const { start, end } = resolveDateRange(datePreset, fromDate, toDate);
    return {
      action: action === ALL ? undefined : action,
      dateFrom: start?.toISOString(),
      dateTo: end?.toISOString(),
      search: debouncedQuery.trim() || undefined,
    };
  }, [action, datePreset, fromDate, toDate, debouncedQuery]);

  // Clamped rather than corrected in state: a result set that shrinks (a
  // narrowing filter, rows aging out) must not strand the user on a page
  // past the end, and deriving it avoids a setState-in-effect round trip.
  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / pageSize));
  const currentPage = Math.min(page, pageCount);

  const request = useMemo(
    () => ({ ...filters, limit: pageSize, offset: (currentPage - 1) * pageSize }),
    [filters, pageSize, currentPage],
  );

  useEffect(() => {
    let cancelled = false;
    auditService
      .list(request)
      // A slow response for a request the user has already moved on from must
      // not overwrite a newer one.
      .then(({ items, total }) => {
        if (!cancelled) setResult({ request, items, total });
      })
      .catch(() => {
        if (!cancelled) setResult({ request, items: [], total: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const isLoading = result?.request !== request;
  const pagedEvents = result?.items ?? [];
  const total = result?.total ?? 0;

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      // Same filters the table is showing, minus paging — the CSV covers the
      // whole matching range, not just the visible page.
      await auditService.downloadCsv(filters);
    } catch {
      setExportError(t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PermissionGuard module="archiveSharingAudit" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canExport ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="size-4" />
                {exporting ? t("exporting") : t("export")}
              </Button>
            ) : null
          }
        />
        {exportError ? (
          <p className="text-destructive mb-4 text-sm">{exportError}</p>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 pl-9"
                />
              </div>
              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value as AuditAction | typeof ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-44"
                  aria-label={t("filterLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
                  {AUDIT_ACTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tActions(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={datePreset}
                onValueChange={(value) => {
                  setDatePreset(value as DatePreset);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-44"
                  aria-label={t("dateFilterLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {tDatePresets(preset)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {datePreset === "custom" ? (
              <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="auditFromDate"
                    className="text-muted-foreground text-xs whitespace-nowrap"
                  >
                    {t("fromDateLabel")}
                  </label>
                  <Input
                    id="auditFromDate"
                    type="date"
                    value={fromDate}
                    // Can't start after the end of the range.
                    max={toDate || undefined}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setPage(1);
                    }}
                    className="h-8 w-full sm:w-44"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="auditToDate"
                    className="text-muted-foreground text-xs whitespace-nowrap"
                  >
                    {t("toDateLabel")}
                  </label>
                  <Input
                    id="auditToDate"
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setPage(1);
                    }}
                    className="h-8 w-full sm:w-44"
                  />
                </div>
                {fromDate || toDate ? (
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs sm:ml-auto"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setPage(1);
                    }}
                  >
                    {t("clearDates")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56 py-3">{t("dateColumn")}</TableHead>
                  <TableHead className="py-3">{t("actorColumn")}</TableHead>
                  <TableHead className="w-32 py-3">{t("actionColumn")}</TableHead>
                  <TableHead className="py-3">{t("targetColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell className="py-5">
                        <div className="bg-muted h-4 w-40 rounded" />
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-3">
                          <div className="bg-muted size-8 rounded-full" />
                          <div className="bg-muted h-4 w-28 rounded" />
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="bg-muted h-5 w-16 rounded" />
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="bg-muted h-4 w-36 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pagedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <History className="size-5" />
                        </div>
                        <p>{t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-muted-foreground py-5 align-top text-sm tabular-nums">
                        {formatTimestamp(event.createdAt)}
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs font-medium">
                              {event.actor ? initials(event.actor.name) : "SYS"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5">
                            <p className="text-foreground text-sm font-medium">
                              {event.actor?.name ?? t("systemActor")}
                            </p>
                            {event.actor ? (
                              <p className="text-muted-foreground text-xs">
                                {event.actor.email}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <Badge variant={ACTION_VARIANT[event.action]}>
                          {tActions(event.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-col space-y-0.5">
                            <span className="text-foreground text-sm break-words whitespace-normal">
                              {event.entityLabel}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {tEntities(event.entityType)}
                            </span>
                          </div>
                          {event.changes && event.changes.length > 0 ? (
                            <ChangeDetailsDialog
                              changes={event.changes}
                              entityLabel={event.entityLabel}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {total > 0 ? (
              <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-40"
                    aria-label={t("rowsPerPageLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROWS_PER_PAGE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {t("rowsPerPageLabel")}: {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                  className="sm:w-auto"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-muted-foreground flex items-center gap-1.5 p-2 text-xs">
          <Lock className="size-3" />
          {t("immutableNotice")}
        </p>
      </PageContainer>
    </PermissionGuard>
  );
}
