"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { parseVillageInput } from "@/lib/villages";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";

interface NeedFormValues {
  title: string;
  statement: string;
  village: string[];
  source: string;
  referenceId: string;
}

function VillageEditor({
  villages,
  onChange,
}: {
  villages: string[];
  onChange: (villages: string[]) => void;
}) {
  const t = useTranslations("app.studies.need");
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const additions = parseVillageInput(draft).filter((v) => !villages.includes(v));
    if (additions.length > 0) onChange([...villages, ...additions]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {villages.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {villages.map((village) => (
            <Badge key={village} variant="secondary" className="gap-1">
              <MapPin className="size-3" />
              {village}
              <button
                type="button"
                onClick={() => onChange(villages.filter((v) => v !== village))}
                aria-label={t("removeVillage", { village })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          id="village"
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            // A trailing comma commits everything typed so far as chips,
            // so typing "Al Wathba, Al Falah," behaves the same as pressing
            // Enter after each one.
            if (value.endsWith(",")) {
              const additions = parseVillageInput(value).filter(
                (v) => !villages.includes(v),
              );
              if (additions.length > 0) onChange([...villages, ...additions]);
              setDraft("");
            } else {
              setDraft(value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={t("villagePlaceholder")}
        />
        <Button type="button" variant="outline" onClick={commitDraft}>
          {t("addVillage")}
        </Button>
      </div>
    </div>
  );
}

export default function CreateNeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studyId } = use(params);
  const t = useTranslations("app.studies.need");
  const tValidation = useTranslations("app.studies.validation");
  const router = useRouter();

  const [study, setStudy] = useState<Study | null>(null);
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
    source: z.string().trim().max(200, tValidation("sourceTooLong")),
    referenceId: z.string().trim().max(200, tValidation("referenceIdTooLong")),
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
      source: "",
      referenceId: "",
    },
  });

  const village = useWatch({ control, name: "village" });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const created = await needsService.create(studyId, {
        title: values.title,
        statement: values.statement,
        village: values.village,
        source: values.source.trim() || undefined,
        referenceId: values.referenceId.trim() || undefined,
      });
      router.push(`/studies/${studyId}/needs/${created.id}`);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    }
  });

  return (
    <PermissionGuard module="dataCollection" action="create">
      <PageContainer>
        <Link
          href={`/studies/${studyId}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {t("backToStudy")}
        </Link>

        <PageHeader title={t("addTitle")} description={t("pageDescription")} />

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
                  <VillageEditor
                    villages={village ?? []}
                    onChange={(next) =>
                      setValue("village", next, { shouldValidate: true })
                    }
                  />
                  {errors.village ? (
                    <p className="text-destructive text-sm">{errors.village.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="source">{t("sourceLabel")}</Label>
                    <Input
                      id="source"
                      placeholder={t("sourcePlaceholder")}
                      {...register("source")}
                    />
                    {errors.source ? (
                      <p className="text-destructive text-sm">{errors.source.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referenceId">{t("referenceIdLabel")}</Label>
                    <Input
                      id="referenceId"
                      placeholder={t("referenceIdPlaceholder")}
                      {...register("referenceId")}
                    />
                    {errors.referenceId ? (
                      <p className="text-destructive text-sm">{errors.referenceId.message}</p>
                    ) : null}
                  </div>
                </div>

                {submitError ? (
                  <p className="text-destructive text-sm">{submitError}</p>
                ) : null}

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? t("saving") : t("save")}
                  </Button>
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
