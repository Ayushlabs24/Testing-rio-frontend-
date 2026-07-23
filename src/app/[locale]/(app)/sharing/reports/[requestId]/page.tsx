"use client";

import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
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
import {
  SHARED_REPORT_TABLE_PAGE_SIZE,
  SHARING_ROWS_PER_PAGE_OPTIONS,
} from "@/config/pagination";
import { flattenReportContent } from "@/lib/report-content-flatten";
import { ApiError } from "@/services/api/types";
import { reportSharingService } from "@/services/report-sharing/report-sharing.service";
import type { SharedReportSnapshot } from "@/services/report-sharing/report-sharing.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toColumnLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

// One card per table/section so a future report shape (charts, maps,
// attachments, new AI-insight blocks) is just another card in this same
// stack — nothing here is hardcoded to today's report fields (see
// flattenReportContent, reused as-is rather than re-parsed per report type).
function DataTableCard({
  name,
  rows,
}: {
  name: string;
  rows: Array<Record<string, unknown>>;
}) {
  const t = useTranslations("app.reportSharing");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(SHARED_REPORT_TABLE_PAGE_SIZE);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col}>{toColumnLabel(col)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row, index) => (
              <TableRow key={index}>
                {columns.map((col) => (
                  <TableCell key={col} className="text-sm">
                    {stringifyCell(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rows.length > 0 ? (
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
                {SHARING_ROWS_PER_PAGE_OPTIONS.map((size) => (
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
  );
}

function SharedReportScreen({ requestId }: { requestId: string }) {
  const t = useTranslations("app.reportSharing.sharedReport");
  const [snapshot, setSnapshot] = useState<SharedReportSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    reportSharingService
      .getSharedReport(requestId)
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const flattened = snapshot ? flattenReportContent(snapshot.content) : null;

  return (
    <PageContainer>
      <div className="mb-6 flex justify-start">
        <BackButton
          href="/sharing?entity=reports&tab=sharedReports"
          label={t("backLabel")}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : !snapshot || !flattened ? (
        <div className="space-y-4">
          <div className="bg-muted h-8 w-1/2 rounded" />
          <div className="bg-muted h-40 w-full rounded" />
        </div>
      ) : (
        <>
          <PageHeader
            title={snapshot.title}
            actions={<Badge variant="secondary">{t("viewOnlyBadge")}</Badge>}
          />

          <Card className="mb-6">
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">{t("generatedByLabel")}</p>
                <p className="text-sm font-medium">{snapshot.generatedByName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("generatedDateLabel")}</p>
                <p className="text-sm font-medium">{formatDate(snapshot.generatedAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("ownerOrgLabel")}</p>
                <p className="text-sm font-medium">{snapshot.ownerOrgName}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {flattened.narrative ? (
              <Card>
                <CardContent className="pt-6 text-sm whitespace-pre-wrap">
                  {flattened.narrative}
                </CardContent>
              </Card>
            ) : null}

            {flattened.summaryRows.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t("summarySectionTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="divide-border divide-y p-0">
                  {flattened.summaryRows.map((row) => (
                    <div
                      key={row.field}
                      className="flex justify-between gap-4 px-6 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{row.field}</span>
                      <span className="text-right break-words">{row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {flattened.tables.map((table) => (
              <DataTableCard key={table.name} name={table.name} rows={table.rows} />
            ))}

            {!flattened.narrative &&
            flattened.summaryRows.length === 0 &&
            flattened.tables.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noContent")}</p>
            ) : null}
          </div>

          <p className="text-muted-foreground border-border mt-6 border-t pt-4 text-xs">
            {t("footerNote")}
          </p>
        </>
      )}
    </PageContainer>
  );
}

export default function SharedReportPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);

  return (
    <PermissionGuard module="archiveSharingAudit" action="read">
      <SharedReportScreen requestId={requestId} />
    </PermissionGuard>
  );
}
