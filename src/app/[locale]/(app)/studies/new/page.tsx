"use client";

import { useEffect, useState } from "react";
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
import { useOrgGovernorates } from "@/hooks/use-org-governorates";
import { useOrgRegionName } from "@/hooks/use-org-region-name";
import {
  severityScoringService,
  type MethodologyVersion,
} from "@/services/priority/severity-scoring.service";
import { studiesService } from "@/services/studies/studies.service";

export default function NewStudyPage() {
  const t = useTranslations("app.studies.form");
  const router = useRouter();
  const orgGovernorates = useOrgGovernorates();
  const regionName = useOrgRegionName();
  const [methodologyVersions, setMethodologyVersions] = useState<MethodologyVersion[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;
    severityScoringService
      .listMethodologyVersions()
      .then((versions) => {
        if (!cancelled)
          setMethodologyVersions(versions.filter((v) => v.status === "PUBLISHED"));
      })
      .catch(() => {
        // Non-fatal — the Select just renders with no options.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (values: StudyFormValues) => {
    const study = await studiesService.create({
      title: values.title,
      governorateIds: values.governorateIds,
      centerIds: values.centerIds,
      methodologyVersionId: values.methodologyVersionId,
    });
    // Capturing the first Need is the next step of the workflow, so go
    // straight there rather than via the Study detail page.
    router.push(`/studies/${study.id}/needs/new`);
    // router.push() enqueues the navigation but doesn't wait for it to
    // finish — returning here would let StudyForm's isSubmitting flip back
    // to false and the button flash re-enabled while this page is still
    // visible. Never resolving keeps it in the loading state until this
    // component unmounts on the route change.
    await new Promise<void>(() => {});
  };

  return (
    <PermissionGuard module="studySurvey" action="create">
      <PageContainer>
        <PageHeader title={t("createTitle")} description={t("createDescription")} />
        <Card>
          <CardContent className="p-6">
            <StudyForm
              orgGovernorates={orgGovernorates}
              regionName={regionName}
              methodologyVersions={methodologyVersions}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/studies")}
            />
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
