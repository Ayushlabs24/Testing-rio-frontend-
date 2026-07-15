"use client";

import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
  StudyForm,
  type StudyFormValues,
} from "@/components/features/studies/study-form";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { studiesService } from "@/services/studies/studies.service";

export default function NewStudyPage() {
  const t = useTranslations("app.studies.form");
  const router = useRouter();

  const handleSubmit = async (values: StudyFormValues) => {
    const study = await studiesService.create({
      title: values.title,
      // "" means "not set" in the form; the API models unset as null.
      description: values.description.trim() || null,
      needStatement: values.needStatement.trim() || null,
      villages: values.villages,
    });
    router.push(`/studies/${study.id}`);
  };

  return (
    <PermissionGuard module="studySurvey" action="create">
      <PageContainer>
        <PageHeader title={t("createTitle")} description={t("createDescription")} />
        <Card>
          <CardContent className="p-6">
            <StudyForm onSubmit={handleSubmit} onCancel={() => router.push("/studies")} />
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
