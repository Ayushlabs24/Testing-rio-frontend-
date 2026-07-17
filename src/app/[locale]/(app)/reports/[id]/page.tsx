"use client";

import { ArrowLeft, Download, FileText, Sparkles, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { Link } from "@/i18n/navigation";
import { flattenReportContent } from "@/lib/report-content-flatten";
import { ApiError } from "@/services/api/types";
import { reportsService } from "@/services/reports/reports.service";
import type { Report, ReportStatus } from "@/services/reports/reports.types";

const STATUS_VARIANT: Record<
  ReportStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  approved: "default",
  rejected: "destructive",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("app.reports");
  const tp = useTranslations("app.reports.preview");
  const canApprove = usePermission("reportsDashboards", "approve");
  const canExport = usePermission("reportsDashboards", "export");

  const [report, setReport] = useState<Report | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    reportsService
      .getById(id)
      .then((row) => {
        setReport(row);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleApprove() {
    setActionError(null);
    try {
      await reportsService.approve(id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tp("reviewError"));
    }
  }

  async function handleReject() {
    setActionError(null);
    try {
      await reportsService.reject(id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tp("reviewError"));
    }
  }

  async function handleExport(format: "pdf" | "excel") {
    setActionError(null);
    try {
      await reportsService.download(id, format);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tp("exportError"));
    }
  }

  const flattened = report ? flattenReportContent(report.content) : null;
  const isEmpty =
    flattened &&
    !flattened.narrative &&
    flattened.summaryRows.length === 0 &&
    flattened.tables.length === 0;

  return (
    <PermissionGuard module="reportsDashboards" action="read">
      <PageContainer>
        <Link
          href="/reports"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          {tp("backToList")}
        </Link>

        {loadFailed ? (
          <p className="text-destructive text-sm">{tp("loadError")}</p>
        ) : !report ? (
          <div className="space-y-4">
            <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
            <div className="bg-muted h-48 animate-pulse rounded-md" />
          </div>
        ) : (
          <>
            <PageHeader
              title={report.title}
              description={
                report.reviewedAt
                  ? `${tp("generatedBy", { date: formatDate(report.generatedAt) })} · ${tp("reviewedOn", { date: formatDate(report.reviewedAt) })}`
                  : tp("generatedBy", { date: formatDate(report.generatedAt) })
              }
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[report.status]}>
                    {t(`status.${report.status}`)}
                  </Badge>
                  {canApprove && report.status === "draft" ? (
                    <>
                      <Button size="sm" variant="outline" onClick={handleApprove}>
                        {tp("approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={handleReject}
                      >
                        {tp("reject")}
                      </Button>
                    </>
                  ) : null}
                  {canExport &&
                  report.status === "approved" &&
                  report.exportFormats.includes("pdf") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleExport("pdf")}
                    >
                      <Download className="size-3.5" />
                      {tp("exportPdf")}
                    </Button>
                  ) : null}
                  {canExport &&
                  report.status === "approved" &&
                  report.exportFormats.includes("excel") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleExport("excel")}
                    >
                      <Download className="size-3.5" />
                      {tp("exportExcel")}
                    </Button>
                  ) : null}
                </div>
              }
            />

            {actionError ? (
              <p className="text-destructive mb-4 text-sm">{actionError}</p>
            ) : null}

            <div className="space-y-6">
              {flattened?.narrative ? (
                <Card>
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="size-4" />
                      {tp("executiveSummaryHeading")}
                    </h2>
                    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {flattened.narrative}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {flattened && flattened.summaryRows.length > 0 ? (
                <Card>
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                      <FileText className="size-4" />
                      {tp("summaryHeading")}
                    </h2>
                    <div className="divide-border divide-y">
                      {flattened.summaryRows.map((row) => (
                        <div
                          key={row.field}
                          className="flex items-center justify-between gap-4 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{row.field}</span>
                          <span className="text-foreground font-medium">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {flattened?.tables.map((table) => {
                const columns = Array.from(
                  new Set(table.rows.flatMap((row) => Object.keys(row))),
                );
                return (
                  <Card key={table.name}>
                    <CardContent className="space-y-3 p-6">
                      <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                        <Table2 className="size-4" />
                        {table.name}
                      </h2>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {columns.map((col) => (
                              <TableHead key={col}>{col}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {table.rows.map((row, index) => (
                            <TableRow key={index}>
                              {columns.map((col) => (
                                <TableCell key={col} className="text-sm">
                                  {row[col] === null || row[col] === undefined
                                    ? "—"
                                    : String(row[col])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}

              {isEmpty ? (
                <Card>
                  <CardContent className="text-muted-foreground p-6 text-center text-sm">
                    {tp("noContent")}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </>
        )}
      </PageContainer>
    </PermissionGuard>
  );
}
