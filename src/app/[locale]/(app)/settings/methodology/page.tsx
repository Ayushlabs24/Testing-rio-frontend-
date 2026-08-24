"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { MethodologyConfigTab } from "@/components/features/methodology/config-tab";
import { DomainsTab } from "@/components/features/methodology/domains-tab";
import { QuestionsTab } from "@/components/features/methodology/questions-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MethodologyConfigurationPage() {
  const t = useTranslations("app.settings.methodology");

  return (
    <PermissionGuard module="methodologyQuestionBank" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Tabs defaultValue="domains">
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
        </Tabs>
      </PageContainer>
    </PermissionGuard>
  );
}
