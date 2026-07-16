"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
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
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";

interface NeedFormValues {
  statement: string;
  village: string[];
  source: string;
}

/** Splits on commas so pasting/typing "Al Wathba, Al Falah, Bani Yas" adds
 * three separate villages, not one literal string — same behavior as Enter. */
function parseVillageInput(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
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

export default function DefineNeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studyId } = use(params);
  const t = useTranslations("app.studies.need");
  const tValidation = useTranslations("app.studies.validation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillVillage = searchParams.get("village") ?? "";

  const [need, setNeed] = useState<Need | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    needsService
      .getByStudy(studyId)
      .then(setNeed)
      .finally(() => setLoaded(true));
  }, [studyId]);

  const schema = z.object({
    statement: z.string().trim().min(1, tValidation("needStatementRequired")),
    village: z.array(z.string()).min(1, tValidation("needVillageRequired")),
    source: z.string().trim().min(1, tValidation("needSourceRequired")),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NeedFormValues>({
    resolver: zodResolver(schema),
    values: {
      statement: need?.statement ?? "",
      village: need?.village ?? parseVillageInput(prefillVillage),
      source: need?.source ?? "",
    },
  });

  const village = useWatch({ control, name: "village" });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (need) {
        await needsService.update(studyId, values);
      } else {
        await needsService.create(studyId, values);
      }
      router.push(`/studies/${studyId}`);
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

        <PageHeader
          title={need ? t("editTitle") : t("addTitle")}
          description={t("pageDescription")}
        />

        <Card>
          <CardContent className="p-6">
            {!loaded ? (
              <div className="space-y-4">
                <div className="bg-muted h-24 w-full rounded" />
                <div className="bg-muted h-10 w-full rounded" />
                <div className="bg-muted h-10 w-full rounded" />
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
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
