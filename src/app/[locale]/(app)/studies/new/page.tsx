"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
  StudyForm,
  type StudyFormValues,
} from "@/components/features/studies/study-form";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { organizationsService } from "@/services/organizations/organizations.service";
import { studiesService } from "@/services/studies/studies.service";

export default function NewStudyPage() {
  const t = useTranslations("app.studies.form");
  const router = useRouter();
  const [orgVillages, setOrgVillages] = useState<string[]>([]);

  useEffect(() => {
    organizationsService
      .getCurrent()
      .then((org) => setOrgVillages(org.villages))
      .catch(() => undefined);
  }, []);

  const handleSubmit = async (values: StudyFormValues) => {
    const study = await studiesService.create({
      title: values.title,
      villages: values.village,
    });
    // Capturing the first Need is the next step of the workflow, so go
    // straight there rather than via the Study detail page.
    router.push(`/studies/${study.id}/needs/new`);
  };

  return (
    <PermissionGuard module="studySurvey" action="create">
      <PageContainer>
        <PageHeader title={t("createTitle")} description={t("createDescription")} />
        <Card>
          <CardContent className="p-6">
            <StudyForm
              orgVillages={orgVillages}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/studies")}
            />
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
