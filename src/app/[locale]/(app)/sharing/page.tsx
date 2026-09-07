"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  StudySharingPanel,
  type SharingInnerTab,
} from "@/components/features/sharing/study-sharing-panel";
import { ReportSharingPanel } from "@/components/features/sharing/report-sharing-panel";

const INNER_TABS: SharingInnerTab[] = [
  "incoming",
  "outgoing",
  "approved",
  "rejected",
  "sharedReports",
  "allOrganizations",
];

// Study-sharing (StudySharingPanel) restored as an outer Studies/Reports
// tab (2026-09-07, client-confirmed) — it had been deliberately hidden at
// the UI layer only (nothing backend-side was ever removed: its own
// Prisma model/service/tests predate FR-014 and were untouched), and is
// now wanted visible again. `tab` still deep-links a sharing-alert
// notification straight to the right ReportSharingPanel sub-tab (e.g.
// Incoming Requests) on the Reports side.
export default function SharingPage() {
  return (
    <Suspense>
      <SharingPageContent />
    </Suspense>
  );
}

function SharingPageContent() {
  const t = useTranslations("app.sharing");
  const searchParams = useSearchParams();

  // `undefined` when the URL doesn't name a valid tab — NOT a hardcoded
  // "incoming" default, which would override ReportSharingPanel's own
  // role-aware default (cross-entity roles land on "allOrganizations";
  // everyone else lands on "incoming") every time this page mounts.
  const tabParam = searchParams.get("tab");
  const initialTab: SharingInnerTab | undefined = INNER_TABS.includes(
    tabParam as SharingInnerTab,
  )
    ? (tabParam as SharingInnerTab)
    : undefined;

  return (
    <PermissionGuard module="archiveSharingAudit" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Tabs defaultValue="reports">
          <TabsList variant="line" size="lg">
            <TabsTrigger value="studies" size="lg">
              {t("entityStudies")}
            </TabsTrigger>
            <TabsTrigger value="reports" size="lg">
              {t("entityReports")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="studies" className="mt-6">
            <StudySharingPanel />
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <ReportSharingPanel initialTab={initialTab} />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGuard>
  );
}
