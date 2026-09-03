"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { InitiativesPanel } from "@/components/features/initiatives/initiatives-panel";

// RIO-FR-009 — Initiative records. Client Q41's literal answer named System
// Admin only; this page is reachable by anyone holding `initiatives:read`
// (see role-matrix.ts's own comment on that grant), with create/edit
// restricted to NGO Admin/Data Analyst/System Admin at the API layer.
export default function InitiativesPage() {
  const t = useTranslations("app.initiatives");

  return (
    <PermissionGuard module="initiatives" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />
        <InitiativesPanel />
      </PageContainer>
    </PermissionGuard>
  );
}
