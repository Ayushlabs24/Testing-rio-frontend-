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
import type { AuditEvent } from "@/services/audit/audit.types";
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
};

const ALL = "all";
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

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

export default function AuditSettingsPage() {
  const t = useTranslations("app.settings.audit");
  const tActions = useTranslations("app.settings.audit.actions");
  const tEntities = useTranslations("app.settings.audit.entities");
  const canExport = usePermission("archiveSharingAudit", "export");
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<AuditAction | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(AUDIT_PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    auditService.list().then(setEvents);
  }, []);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await auditService.downloadCsv();
    } catch {
      setExportError(t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (events ?? []).filter((event) => {
      if (action !== ALL && event.action !== action) return false;
      if (!normalized) return true;
      return (
        (event.actor?.name.toLowerCase().includes(normalized) ?? false) ||
        (event.actor?.email.toLowerCase().includes(normalized) ?? false) ||
        event.entityLabel.toLowerCase().includes(normalized)
      );
    });
  }, [events, query, action]);

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedEvents = filteredEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

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
            </div>

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
                {events === null ? (
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
                ) : filteredEvents.length === 0 ? (
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
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-foreground text-sm">
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

            {filteredEvents.length > 0 ? (
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
