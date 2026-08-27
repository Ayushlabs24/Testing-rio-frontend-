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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useOrgGovernorates } from "@/hooks/use-org-governorates";
import { useOrgRegionName } from "@/hooks/use-org-region-name";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import {
  severityScoringService,
  type MethodologyVersion,
} from "@/services/priority/severity-scoring.service";
import { studyConfigService } from "@/services/study-config/study-config.service";
import type { StudyConfigOption } from "@/services/study-config/study-config.types";
import { studiesService } from "@/services/studies/studies.service";

export default function NewStudyPage() {
  const t = useTranslations("app.studies.form");
  const router = useRouter();
  const { session } = useAuth();
  // RIO-RBAC-002 (client-confirmed, 2026-08-27 round) — System Admin is
  // platform-wide, not tied to one org, so it must explicitly choose which
  // organisation a new Study belongs to. Every other role creates a Study
  // under its own org, same as before — this selector never shows for them.
  const isCrossEntity = session?.role.crossEntity === true;
  const [orgs, setOrgs] = useState<OrganizationSummary[]>([]);
  const [actAsOrgId, setActAsOrgId] = useState<string>("");

  useEffect(() => {
    if (!isCrossEntity) return;
    let cancelled = false;
    organizationsService
      .listAll()
      .then((all) => {
        if (!cancelled) setOrgs(all);
      })
      .catch(() => {
        // Non-fatal — the Select just renders with no options.
      });
    return () => {
      cancelled = true;
    };
  }, [isCrossEntity]);

  const orgGovernorates = useOrgGovernorates(isCrossEntity ? actAsOrgId : undefined);
  const regionName = useOrgRegionName(isCrossEntity ? actAsOrgId : undefined);
  const [methodologyVersions, setMethodologyVersions] = useState<MethodologyVersion[]>(
    [],
  );
  const [studyTypes, setStudyTypes] = useState<StudyConfigOption[]>([]);
  const [targetSectors, setTargetSectors] = useState<StudyConfigOption[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      studyConfigService.listStudyTypes(),
      studyConfigService.listTargetSectors(),
    ])
      .then(([types, sectors]) => {
        if (cancelled) return;
        setStudyTypes(types.filter((o) => o.isActive));
        setTargetSectors(sectors.filter((o) => o.isActive));
      })
      .catch(() => {
        // Non-fatal — both Selects just render with no options.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (values: StudyFormValues) => {
    const study = await studiesService.create(
      {
        title: values.title,
        governorateIds: values.governorateIds,
        centerIds: values.centerIds,
        methodologyVersionId: values.methodologyVersionId,
        population: values.population,
        marginOfError: values.marginOfError,
        studyType: values.studyType ?? undefined,
        targetSector: values.targetSector ?? undefined,
      },
      isCrossEntity ? actAsOrgId : undefined,
    );
    // Go straight to the new study's detail page — it already exposes Add
    // Need / Import Needs / Import Survey Results directly, so the old
    // intermediate options screen was pure redundancy.
    router.push(`/studies/${study.id}`);
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
          <CardContent className="space-y-6 p-6">
            {isCrossEntity ? (
              <div className="space-y-1.5">
                <Label>{t("organizationLabel")}</Label>
                <Select value={actAsOrgId} onValueChange={setActAsOrgId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("organizationPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">{t("organizationHint")}</p>
              </div>
            ) : null}
            {!isCrossEntity || actAsOrgId ? (
              <StudyForm
                orgGovernorates={orgGovernorates}
                regionName={regionName}
                methodologyVersions={methodologyVersions}
                studyTypes={studyTypes}
                targetSectors={targetSectors}
                onSubmit={handleSubmit}
                onCancel={() => router.push("/studies")}
              />
            ) : null}
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
