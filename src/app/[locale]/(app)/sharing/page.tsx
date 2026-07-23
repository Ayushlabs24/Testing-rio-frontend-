"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudySharingPanel } from "@/components/features/sharing/study-sharing-panel";
import { ReportSharingPanel } from "@/components/features/sharing/report-sharing-panel";

// Studies and Reports sharing used to be two separate sidebar entries with
// near-identical pages (same incoming/outgoing/approved/rejected/shared-
// reports tab structure, just a different shared entity) — merged into one
// "Sharing" entry with an outer Studies/Reports tab instead, so there's a
// single place to look for either.
export default function SharingPage() {
  const t = useTranslations("app.sharing");

  return (
    <PermissionGuard module="archiveSharingAudit" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Tabs defaultValue="studies">
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
            <ReportSharingPanel />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGuard>
  );
}
