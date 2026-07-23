"use client";

import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
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
import type { Study } from "@/services/studies/studies.types";

export default function EditStudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("app.studies.form");
  const tStudies = useTranslations("app.studies");
  const router = useRouter();
  const orgGovernorates = useOrgGovernorates();
  const regionName = useOrgRegionName();
  const [methodologyVersions, setMethodologyVersions] = useState<MethodologyVersion[]>(
    [],
  );

  const [study, setStudy] = useState<Study | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    studiesService
      .getById(id)
      .then(setStudy)
      .catch(() => setNotFound(true));
  }, [id]);

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
    await studiesService.update(id, {
      title: values.title,
      governorateIds: values.governorateIds,
      centerIds: values.centerIds,
      methodologyVersionId: values.methodologyVersionId,
    });
    router.push(`/studies/${id}`);
  };

  return (
    <PermissionGuard module="studySurvey" action="write">
      <PageContainer>
        <PageHeader title={t("editTitle")} description={t("editDescription")} />
        <Card>
          <CardContent className="p-6">
            {notFound ? (
              <p className="text-muted-foreground text-sm">{tStudies("noResults")}</p>
            ) : study === null ? (
              <div className="space-y-4">
                <div className="bg-muted h-10 w-full rounded" />
                <div className="bg-muted h-10 w-full rounded" />
                <div className="bg-muted h-24 w-full rounded" />
              </div>
            ) : (
              <StudyForm
                study={study}
                orgGovernorates={orgGovernorates}
                regionName={regionName}
                methodologyVersions={methodologyVersions}
                onSubmit={handleSubmit}
                onCancel={() => router.push(`/studies/${id}`)}
              />
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
