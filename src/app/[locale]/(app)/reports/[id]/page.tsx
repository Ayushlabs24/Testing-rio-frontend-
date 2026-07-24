"use client";

import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ReportActions } from "@/components/features/reports/report-actions";
import { ReportContentView } from "@/components/features/reports/report-content-view";
import { ReportStatusBadge } from "@/components/features/reports/report-status-badge";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { reportsService } from "@/services/reports/reports.service";
import type { Report } from "@/services/reports/reports.types";

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
  const tp = useTranslations("app.reports.preview");

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

  return (
    <PermissionGuard module="reportsDashboards" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/reports" label={tp("backToList")} />
        </div>

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
        )}
      </PageContainer>
    </PermissionGuard>
  );
}
