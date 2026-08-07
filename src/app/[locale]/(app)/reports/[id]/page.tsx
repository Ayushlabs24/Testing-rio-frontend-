"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
  formatDate as formatNcnpDate,
  NcnpReportContentView,
  reportId as consolidatedReportId,
} from "@/components/features/ncnp-report/ncnp-report-content-view";
import { NcnpReportReviewActions } from "@/components/features/ncnp-report/ncnp-report-review-actions";
import { NcnpReportReviewBadge } from "@/components/features/ncnp-report/ncnp-report-review-badge";
import { ReportActions } from "@/components/features/reports/report-actions";
import { ReportContentView } from "@/components/features/reports/report-content-view";
import { ReportStatusBadge } from "@/components/features/reports/report-status-badge";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format-date";
import type { NcnpReport } from "@/services/ncnp-report/ncnp-report.types";
import {
  ncnpReportReviewService,
  type NcnpReportReviewDetail,
} from "@/services/ncnp-report-review/ncnp-report-review.service";
import { reportsService } from "@/services/reports/reports.service";
import type { Report } from "@/services/reports/reports.types";

const CONSOLIDATED_EXPORTABLE_STATUSES = ["released"];

function NgoReportDetail({ id }: { id: string }) {
  const tp = useTranslations("app.reports.preview");
  const locale = useLocale() as AppLocale;
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

  if (loadFailed) {
    return <p className="text-destructive text-sm">{tp("loadError")}</p>;
  }
  if (!report) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-48 animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={report.title}
        description={
          report.reviewedAt
            ? `${tp("generatedBy", { date: formatDateTime(report.generatedAt, locale) })} · ${tp("reviewedOn", { date: formatDateTime(report.reviewedAt, locale) })}`
            : tp("generatedBy", { date: formatDateTime(report.generatedAt, locale) })
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={report.status} />
            <ReportActions
              report={report}
              onChanged={load}
              onError={(m) => setActionError(m || null)}
            />
          </div>
        }
      />

      {actionError ? (
        <p className="text-destructive mb-4 text-sm">{actionError}</p>
      ) : null}

      <ReportContentView report={report} />
    </>
  );
}

function ConsolidatedReportDetail({ id }: { id: string }) {
  const t = useTranslations("systemAdmin.ncnpReport");
  const tr = useTranslations("systemAdmin.ncnpReport.review");
  const locale = useLocale() as AppLocale;
  const [review, setReview] = useState<NcnpReportReviewDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "excel" | null>(null);
  const [exportError, setExportError] = useState(false);

  function load() {
    ncnpReportReviewService
      .getById(id)
      .then((row) => {
        setReview(row);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleExport(format: "pdf" | "excel") {
    setExportingFormat(format);
    setExportError(false);
    try {
      await ncnpReportReviewService.download(id, format);
    } catch {
      setExportError(true);
    } finally {
      setExportingFormat(null);
    }
  }

  if (loadFailed) {
    return <p className="text-destructive text-sm">{tr("loadError")}</p>;
  }
  if (!review) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-48 animate-pulse rounded-md" />
      </div>
    );
  }

  const exportable = CONSOLIDATED_EXPORTABLE_STATUSES.includes(review.status);

  return (
    <>
      <PageHeader
        title={`${t("title")} — ${consolidatedReportId(review.generatedAt)}`}
        description={tr("generatedByOn", {
          name: review.generatedByName ?? "—",
          date: formatNcnpDate(review.generatedAt, locale),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NcnpReportReviewBadge
              status={review.status}
              label={t(`review.status.${review.status}`)}
            />
            <NcnpReportReviewActions
              review={review}
              onChanged={load}
              onError={(m) => setActionError(m || null)}
            />
            {exportable ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportingFormat !== null}
                  onClick={() => handleExport("pdf")}
                >
                  <Download className="size-4" />
                  {exportingFormat === "pdf" ? "…" : t("exportPdf")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportingFormat !== null}
                  onClick={() => handleExport("excel")}
                >
                  <Download className="size-4" />
                  {exportingFormat === "excel" ? "…" : t("exportExcel")}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {actionError ? (
        <p className="text-destructive mb-4 text-sm">{actionError}</p>
      ) : null}
      {exportError ? (
        <p className="text-destructive mb-4 text-sm">{t("exportError")}</p>
      ) : null}

      {/* Reviewer Notes — shown whenever a decision has been made, including
          to System Admin viewing an approved report before deciding whether
          to Publish (context, not just after the fact). */}
      {review.reviewedAt ? (
        <div className="border-border/60 bg-muted/20 mb-6 rounded-xl border p-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground">{tr("reviewerLabel")}: </span>
              <span className="text-foreground font-semibold">
                {review.reviewedByName ?? "—"}
              </span>
            </span>
            <span>
              <span className="text-muted-foreground">{tr("reviewedOnLabel")}: </span>
              <span className="text-foreground font-semibold">
                {formatNcnpDate(review.reviewedAt, locale)}
              </span>
            </span>
          </div>
          <p className="text-foreground mb-1 text-sm font-semibold">
            {tr("reviewerNotesHeading")}
          </p>
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {review.reviewerNotes || tr("reviewerNotesEmpty")}
          </p>
        </div>
      ) : null}

      <NcnpReportContentView
        report={review.content as unknown as NcnpReport}
        generatedByName={review.generatedByName ?? "—"}
      />
    </>
  );
}

export default function ReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tp = useTranslations("app.reports.preview");
  const searchParams = useSearchParams();
  const isConsolidated = searchParams.get("type") === "consolidated";

  return (
    <PermissionGuard
      module={isConsolidated ? "ncnpReport" : "reportsDashboards"}
      action="read"
    >
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/reports" label={tp("backToList")} />
        </div>

        {isConsolidated ? (
          <ConsolidatedReportDetail id={id} />
        ) : (
          <NgoReportDetail id={id} />
        )}
      </PageContainer>
    </PermissionGuard>
  );
}
