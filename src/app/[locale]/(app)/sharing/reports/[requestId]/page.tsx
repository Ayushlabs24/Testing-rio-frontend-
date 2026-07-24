"use client";

import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { ReportContentView } from "@/components/features/reports/report-content-view";
import { ApiError } from "@/services/api/types";
import { reportSharingService } from "@/services/report-sharing/report-sharing.service";
import type { SharedReportSnapshot } from "@/services/report-sharing/report-sharing.types";
import type { Report, ReportTypeCode } from "@/services/reports/reports.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

// Same document (cover + numbered sections, charts, tables) the owner's own
// Report Preview page renders — a shared report must look identical to the
// original, not a separate generic renderer. `<ReportContentView>` only ever
// reads `content`/`id`/`officerConfirmedBy(At)`/`reviewedBy(At)` (see that
// component), so a SharedReportSnapshot maps onto the `Report` shape it
// expects with everything else defaulted — status/studyId/filters/etc. are
// never read by this view and exporting isn't wired here at all (view-only
// by construction: <ReportActions> is a sibling component on the owner's own
// page, never rendered by <ReportContentView> itself).
function toReport(snapshot: SharedReportSnapshot): Report {
  return {
    id: snapshot.reportId,
    reportType: snapshot.reportType as ReportTypeCode,
    status: "released",
    title: snapshot.title,
    studyId: null,
    filters: {},
    content: snapshot.content,
    generatedBy: "",
    generatedByName: null,
    generatedAt: snapshot.generatedAt,
    officerConfirmedBy: snapshot.officerConfirmedBy,
    officerConfirmedByName: null,
    officerConfirmedAt: snapshot.officerConfirmedAt,
    reviewedBy: snapshot.reviewedBy,
    reviewedByName: null,
    reviewedAt: snapshot.reviewedAt,
    archivedAt: null,
    exportFormats: [],
  };
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
      ) : !snapshot ? (
        <div className="space-y-4">
          <div className="bg-muted h-8 w-1/2 rounded" />
          <div className="bg-muted h-40 w-full rounded" />
        </div>
      ) : (
        <>
          <PageHeader
            title={snapshot.title}
            description={t("sharedByLabel", {
              org: snapshot.ownerOrgName,
              date: formatDate(snapshot.generatedAt),
            })}
            actions={<Badge variant="secondary">{t("viewOnlyBadge")}</Badge>}
          />

          <ReportContentView report={toReport(snapshot)} />

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
