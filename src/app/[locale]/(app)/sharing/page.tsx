"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import type { SharingInnerTab } from "@/components/features/sharing/study-sharing-panel";
import { ReportSharingPanel } from "@/components/features/sharing/report-sharing-panel";

const INNER_TABS: SharingInnerTab[] = [
  "incoming",
  "outgoing",
  "approved",
  "rejected",
  "sharedReports",
];

// Study-sharing (StudySharingPanel, an outer Studies/Reports tab here) is
// intentionally not wired up on this page — it's a real, working feature
// (predates FR-014, its own Prisma model/service/tests all still exist and
// are untouched), just not part of the currently assigned scope for this
// page. Hidden at the UI layer only: nothing backend-side was removed, so
// it can come back by re-adding the outer entity tabs (see git history for
// the previous version of this file) without any data migration. `tab`
// still deep-links a sharing-alert notification straight to the right
// ReportSharingPanel sub-tab (e.g. Incoming Requests).
export default function SharingPage() {
  return (
    <Suspense>
      <SharingPageContent />
    </Suspense>
  );
}

function SharingPageContent() {
  const t = useTranslations("app.reportSharing");
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const initialTab: SharingInnerTab = INNER_TABS.includes(tabParam as SharingInnerTab)
    ? (tabParam as SharingInnerTab)
    : "incoming";

  return (
    <PermissionGuard module="archiveSharingAudit" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />
        <ReportSharingPanel initialTab={initialTab} />
      </PageContainer>
    </PermissionGuard>
  );
}
