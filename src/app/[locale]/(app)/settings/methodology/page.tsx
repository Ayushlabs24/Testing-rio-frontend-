"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { MethodologyConfigTab } from "@/components/features/methodology/config-tab";
import { ConsentPoliciesTab } from "@/components/features/methodology/consent-policies-tab";
import { DomainsTab } from "@/components/features/methodology/domains-tab";
import { QuestionsTab } from "@/components/features/methodology/questions-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks/use-permission";

const VALID_TABS = ["domains", "config", "questions", "consent"] as const;
type MethodologyTab = (typeof VALID_TABS)[number];

function isMethodologyTab(value: string | null): value is MethodologyTab {
  return VALID_TABS.includes(value as MethodologyTab);
}

export default function MethodologyConfigurationPage() {
  return (
    <Suspense>
      <MethodologyConfigurationPageContent />
    </Suspense>
  );
}

function MethodologyConfigurationPageContent() {
  const t = useTranslations("app.settings.methodology");
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<MethodologyTab>(
    isMethodologyTab(tabParam) ? tabParam : "domains",
  );

  // Keeps a notification's `?tab=` deep link working even when the bell is
  // clicked from a page that's already /settings/methodology — Next.js
  // doesn't remount the page for a query-only navigation, so defaultValue
  // alone (evaluated once at mount) would miss that case. Adjusted during
  // render (React's documented pattern for this) rather than in an effect,
  // so it doesn't trigger a cascading extra render.
  const [prevTabParam, setPrevTabParam] = useState(tabParam);
  if (tabParam !== prevTabParam) {
    setPrevTabParam(tabParam);
    if (isMethodologyTab(tabParam)) setActiveTab(tabParam);
  }

  // The page as a whole is gated on methodologyQuestionBank:read, but consent
  // policy content is governed by its own module — and several roles that can
  // read the methodology (Research Officer, Read-only Viewer) hold no
  // onboardingConsent grant at all. Without this the tab would render for them
  // and immediately 403 on its first request.
  const canSeeConsent = usePermission("onboardingConsent", "read");

  return (
    <PermissionGuard module="methodologyQuestionBank" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MethodologyTab)}>
          <TabsList variant="line" size="lg">
            <TabsTrigger value="domains" size="lg">
              {t("tabs.domains")}
            </TabsTrigger>
            <TabsTrigger value="config" size="lg">
              {t("tabs.config")}
            </TabsTrigger>
            <TabsTrigger value="questions" size="lg">
              {t("tabs.questions")}
            </TabsTrigger>
            {/* Client-confirmed (2026-08-27): the signup Terms of Use and
                Data Sharing Policy become versioned, app-managed content in
                V2, and the client asked for it to live here — "a UI page tab
                in methodology configuration like other tabs". */}
            {canSeeConsent ? (
              <TabsTrigger value="consent" size="lg">
                {t("tabs.consent")}
              </TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="domains" className="mt-6">
            <DomainsTab />
          </TabsContent>
          <TabsContent value="config" className="mt-6">
            <MethodologyConfigTab />
          </TabsContent>
          <TabsContent value="questions" className="mt-6">
            <QuestionsTab />
          </TabsContent>
          {canSeeConsent ? (
            <TabsContent value="consent" className="mt-6">
              <ConsentPoliciesTab />
            </TabsContent>
          ) : null}
        </Tabs>
      </PageContainer>
    </PermissionGuard>
  );
}
