"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { BackButton } from "@/components/common/back-button";
import {
  DomainCategoryPicker,
  type DomainCategoryValue,
} from "@/components/common/domain-category-picker";
import { GovernoratePicker } from "@/components/common/governorate-picker";
import { LoadingButton } from "@/components/common/loading-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import { organizationsService } from "@/services/organizations/organizations.service";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";
import { surveysService, type QuestionOption } from "@/services/surveys/surveys.service";

interface NeedFormValues {
  title: string;
  statement: string;
  village: string[];
  domain: string;
  subDomain: string;
}

export default function CreateNeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studyId } = use(params);
  const t = useTranslations("app.studies.need");
  const tValidation = useTranslations("app.studies.validation");
  const router = useRouter();

  const [study, setStudy] = useState<Study | null>(null);
  const [orgVillages, setOrgVillages] = useState<string[]>([]);
  const [domainOptions, setDomainOptions] = useState<QuestionOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    studiesService
      .getById(studyId)
      .then((result) => {
        if (!cancelled) setStudy(result);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    organizationsService
      .getCurrent()
      .then((org) => {
        if (!cancelled) setOrgVillages(org.villages);
      })
      .catch(() => {
        // Non-fatal — the picker still works with free text if this fails.
      });
    surveysService
      .getDomainOptions()
      .then((options) => {
        if (!cancelled) setDomainOptions(options);
      })
      .catch(() => {
        // Non-fatal for page load — the field just has nothing to pick
        // from yet; the required validation still blocks submission.
      });
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(300, tValidation("titleTooLong")),
    statement: z.string().trim().min(1, tValidation("needStatementRequired")),
    village: z.array(z.string()).min(1, tValidation("needVillageRequired")),
    domain: z.string().trim().min(1, tValidation("domainCategoryRequired")),
    subDomain: z.string().trim().min(1, tValidation("domainCategoryRequired")),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NeedFormValues>({
    resolver: zodResolver(schema),
    // A new Need starts from the villages configured on its Study; once the
    // Need exists it owns its own list and the Study's is no longer imposed.
    values: {
      title: "",
      statement: "",
      village: study?.villages ?? [],
      domain: "",
      subDomain: "",
    },
  });

  const village = useWatch({ control, name: "village" });
  const domain = useWatch({ control, name: "domain" });
  const subDomain = useWatch({ control, name: "subDomain" });
  const domainValue: DomainCategoryValue | null =
    domain && subDomain ? { domain, subDomain } : null;

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const created = await needsService.create(studyId, {
        title: values.title,
        statement: values.statement,
        village: values.village,
        domain: values.domain,
        subDomain: values.subDomain,
      });
      router.push(`/studies/${studyId}/needs/${created.id}`);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    }
  });

  return (
    <PermissionGuard module="dataCollection" action="create">
      <PageContainer>
        <PageHeader
          title={t("addTitle")}
          description={t("pageDescription")}
          actions={<BackButton href={`/studies/${studyId}`} label={t("backToStudy")} />}
        />

        <Card>
          <CardContent className="p-6">
            {!loaded ? (
              <div className="space-y-4">
                <div className="bg-muted h-24 w-full rounded" />
                <div className="bg-muted h-10 w-full rounded" />
                <div className="bg-muted h-10 w-full rounded" />
              </div>
            ) : notFound ? (
              <p className="text-muted-foreground text-sm">{t("studyNotFound")}</p>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title">{t("titleLabel")}</Label>
                  <Input
                    id="title"
                    placeholder={t("titlePlaceholder")}
                    {...register("title")}
                  />
                  {errors.title ? (
                    <p className="text-destructive text-sm">{errors.title.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="statement">{t("statementLabel")}</Label>
                  <textarea
                    id="statement"
                    rows={5}
                    placeholder={t("statementPlaceholder")}
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    {...register("statement")}
                  />
                  {errors.statement ? (
                    <p className="text-destructive text-sm">{errors.statement.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="village">{t("villageLabel")}</Label>
                  <GovernoratePicker
                    values={village ?? []}
                    options={orgVillages}
                    onChange={(next) =>
                      setValue("village", next, { shouldValidate: true })
                    }
                  />
                  {errors.village ? (
                    <p className="text-destructive text-sm">{errors.village.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain">{t("domainCategoryLabel")}</Label>
                  <DomainCategoryPicker
                    value={domainValue}
                    options={domainOptions}
                    onChange={(next) => {
                      setValue("domain", next.domain, { shouldValidate: true });
                      setValue("subDomain", next.subDomain, { shouldValidate: true });
                    }}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("domainCategoryHint")}
                  </p>
                  {errors.domain || errors.subDomain ? (
                    <p className="text-destructive text-sm">
                      {errors.domain?.message ?? errors.subDomain?.message}
                    </p>
                  ) : null}
                </div>

                {submitError ? (
                  <p className="text-destructive text-sm">{submitError}</p>
                ) : null}

                <div className="flex items-center gap-2">
                  <LoadingButton
                    type="submit"
                    isLoading={isSubmitting}
                    text={isSubmitting ? t("saving") : t("save")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/studies/${studyId}`)}
                    disabled={isSubmitting}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
