"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/common/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgCentersForGovernorates } from "@/hooks/use-org-centers-for-governorates";
import { previewSampleSize } from "@/lib/sample-size";
import { ApiError } from "@/services/api/types";
import type { Governorate } from "@/services/geography/geography.types";
import type { MethodologyVersion } from "@/services/priority/severity-scoring.service";
import type { StudyConfigOption } from "@/services/study-config/study-config.types";
import type { Study } from "@/services/studies/studies.types";

export interface StudyFormValues {
  title: string;
  /** Mandatory subset of the org's own selected Governorates. */
  governorateIds: string[];
  /** Mandatory subset of the org's own selected Centers, filtered by
   * `governorateIds`. */
  centerIds: string[];
  /** Mandatory link to a PUBLISHED MethodologyVersion — a Study must bind
   * to one at creation. */
  methodologyVersionId: string;
  /** RIO-FR-024: the area's population — required at creation only, used
   * once to compute the required sample size and MDE server-side. Ignored
   * on edit (the form shows the stored result instead, read-only). */
  population: number;
  /** RIO-FR-024: the only sample-size parameter the Methodology workbook
   * calls out as "configurable per study" (confidence/p/power stay fixed
   * defaults server-side). ±10% (0.10) is the standard default; ±5% (0.05)
   * is the tighter option the workbook itself names for trend-cycle studies
   * that need finer detection, at the cost of a much larger required sample. */
  marginOfError: number;
  /** RIO-FR-012 (Q3/Q4/Q35) — sourced from a configurable list, not free
   * text. Optional: the client's real value list is still unconfirmed, so
   * this can't be made mandatory yet without blocking Study creation on an
   * interim placeholder choice. */
  studyType: string | null;
  targetSector: string | null;
}

interface StudyFormProps {
  /** Omit to create; pass a study to edit. */
  study?: Study;
  /** The org's own selected Governorates, as full objects — Governorate
   * MultiSelect options. */
  orgGovernorates: Governorate[];
  /** The org's own single Region, resolved to a display name — always
   * read-only here, inherited from the Organization, never submitted. */
  regionName: string;
  /** PUBLISHED Methodology Versions only — Select options. */
  methodologyVersions: MethodologyVersion[];
  /** Active Study Type / Target Sector options — RIO-FR-012, Q3/Q4/Q35.
   * Placeholder values today; the client's real list swaps in here without
   * any form change once confirmed. */
  studyTypes: StudyConfigOption[];
  targetSectors: StudyConfigOption[];
  /** System Admin only: the org this Study is being created for, when it
   * differs from the acting user's own — see useOrgCentersForGovernorates. */
  actAsOrgId?: string;
  onSubmit: (values: StudyFormValues) => Promise<void>;
  onCancel: () => void;
}

export function StudyForm({
  study,
  orgGovernorates,
  regionName,
  methodologyVersions,
  studyTypes,
  targetSectors,
  actAsOrgId,
  onSubmit,
  onCancel,
}: StudyFormProps) {
  const t = useTranslations("app.studies.form");
  const tValidation = useTranslations("app.studies.validation");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isCreate = study === undefined;

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(300, tValidation("titleTooLong")),
    governorateIds: z.array(z.string()).min(1, tValidation("governorateIdsRequired")),
    centerIds: z.array(z.string()).min(1, tValidation("centerIdsRequired")),
    methodologyVersionId: z.string().min(1, tValidation("methodologyVersionRequired")),
    population: z
      .number()
      .refine(
        (value) => !isCreate || Number.isInteger(value),
        tValidation("populationInvalid"),
      )
      .refine((value) => !isCreate || value > 0, tValidation("populationInvalid")),
    marginOfError: z.number(),
    studyType: z.string().nullable(),
    targetSector: z.string().nullable(),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StudyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: study?.title ?? "",
      governorateIds: study?.governorateIds ?? [],
      centerIds: study?.centerIds ?? [],
      methodologyVersionId: study?.methodologyVersionId ?? "",
      population: study?.population ?? 0,
      marginOfError: study?.marginOfError ?? 0.1,
      studyType: study?.studyType ?? null,
      targetSector: study?.targetSector ?? null,
    },
  });

  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });
  const methodologyVersionId = useWatch({ control, name: "methodologyVersionId" });
  const marginOfError = useWatch({ control, name: "marginOfError" });
  const population = useWatch({ control, name: "population" });
  const studyType = useWatch({ control, name: "studyType" });
  const targetSector = useWatch({ control, name: "targetSector" });
  const samplePreview = isCreate ? previewSampleSize(population, marginOfError) : null;

  const { centers: orgCenters, loaded: orgCentersLoaded } = useOrgCentersForGovernorates(
    governorateIds,
    actAsOrgId,
  );

  // Center options are scoped to the currently-selected Governorates —
  // whenever that set (or the org's own Center list) changes and the
  // resolved option list lands, a previously-selected Center that no longer
  // applies is pruned, same prune-stale-selection pattern as the
  // Organization settings page. Gated on `orgCentersLoaded` — the hook's
  // own initial state is an empty array *before* its fetch resolves, and
  // pruning against that would wipe out an edited Study's existing
  // centerIds on mount, before the real list ever arrives. No
  // `shouldValidate` here — this runs on mount too (before the user has
  // touched anything), and forcing validation then would show "required"
  // errors before any real interaction. Submitting (or editing a field
  // directly) still validates normally.
  useEffect(() => {
    if (!orgCentersLoaded) return;
    const validIds = new Set(orgCenters.map((c) => c.id));
    setValue(
      "centerIds",
      centerIds.filter((id) => validIds.has(id)),
    );
    // centerIds is read fresh via closure, not tracked as a dependency —
    // this effect should only re-run when the resolved Center option list
    // itself changes, not on every Center toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgCenters, orgCentersLoaded]);

  // Default to the (most recently) published Methodology Version instead of
  // leaving the required field empty — `methodologyVersions` arrives
  // asynchronously (the caller renders this form before its own fetch
  // resolves), so this can't just be part of `defaultValues` above. Only
  // fires while nothing's selected yet, so it never overrides a Study that
  // already has its own explicit choice. A pre-existing Study created
  // before this field became mandatory may still load with none selected —
  // this same effect fills it in, and the user must save to persist it.
  // Already ordered most-recent-first by the backend.
  useEffect(() => {
    if (methodologyVersionId) return;
    const mostRecentlyPublished = methodologyVersions[0];
    if (!mostRecentlyPublished) return;
    setValue("methodologyVersionId", mostRecentlyPublished.id);
  }, [methodologyVersions, methodologyVersionId, setValue]);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : tValidation("titleRequired"),
      );
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">
          {t("titleLabel")} <span className="text-destructive">*</span>
        </Label>
        <Input id="title" placeholder={t("titlePlaceholder")} {...register("title")} />
        {errors.title ? (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        ) : null}
      </div>

      {/* Compact scalar fields paired up so the form doesn't turn into one
          long single-column scroll — each pair collapses to one column
          below the md breakpoint instead of squeezing on mobile. */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("regionLabel")}</Label>
          <Input value={regionName} readOnly disabled />
          <p className="text-muted-foreground text-sm">{t("regionHint")}</p>
        </div>

        <div className="space-y-2">
          <Label>
            {t("methodologyVersionLabel")} <span className="text-destructive">*</span>
          </Label>
          <Select
            value={methodologyVersionId}
            onValueChange={(value) =>
              setValue("methodologyVersionId", value, { shouldValidate: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("methodologyVersionPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {methodologyVersions.map((mv) => (
                <SelectItem key={mv.id} value={mv.id}>
                  {mv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.methodologyVersionId ? (
            <p className="text-destructive text-sm">
              {errors.methodologyVersionId.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{t("studyTypeLabel")}</Label>
          <Select
            value={studyType ?? ""}
            onValueChange={(value) => setValue("studyType", value || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("studyTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {studyTypes.map((option) => (
                <SelectItem key={option.id} value={option.name}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">{t("studyTypeHint")}</p>
        </div>

        <div className="space-y-2">
          <Label>{t("targetSectorLabel")}</Label>
          <Select
            value={targetSector ?? ""}
            onValueChange={(value) => setValue("targetSector", value || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("targetSectorPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {targetSectors.map((option) => (
                <SelectItem key={option.id} value={option.name}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>
            {t("governorateLabel")} <span className="text-destructive">*</span>
          </Label>
          <MultiSelect
            options={orgGovernorates.map((g) => ({ value: g.id, label: g.name }))}
            values={governorateIds}
            onChange={(next) => setValue("governorateIds", next)}
            placeholder={t("governoratePlaceholder")}
            searchPlaceholder={t("governorateSearchPlaceholder")}
            emptyText={t("governorateEmpty")}
            removeAriaLabel={(governorate) =>
              t("removeGovernorateSelection", { governorate })
            }
          />
          {errors.governorateIds ? (
            <p className="text-destructive text-sm">{errors.governorateIds.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>
            {t("centerLabel")} <span className="text-destructive">*</span>
          </Label>
          <MultiSelect
            options={orgCenters.map((c) => ({ value: c.id, label: c.name }))}
            values={centerIds}
            onChange={(next) => setValue("centerIds", next)}
            placeholder={
              governorateIds.length > 0
                ? t("centerPlaceholder")
                : t("selectGovernorateFirst")
            }
            searchPlaceholder={t("centerSearchPlaceholder")}
            emptyText={t("centerEmpty")}
            removeAriaLabel={(center) => t("removeCenterSelection", { center })}
            disabled={governorateIds.length === 0}
          />
          {errors.centerIds ? (
            <p className="text-destructive text-sm">{errors.centerIds.message}</p>
          ) : null}
        </div>
      </div>

      {isCreate ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="population">
              {t("populationLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="population"
              type="number"
              min={1}
              step={1}
              placeholder={t("populationPlaceholder")}
              {...register("population", { valueAsNumber: true })}
            />
            <p className="text-muted-foreground text-sm">{t("populationHint")}</p>
            {errors.population ? (
              <p className="text-destructive text-sm">{errors.population.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("marginOfErrorLabel")}</Label>
            <Select
              value={String(marginOfError)}
              onValueChange={(value) => setValue("marginOfError", Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.1">{t("marginOfError10")}</SelectItem>
                <SelectItem value="0.05">{t("marginOfError5")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">{t("marginOfErrorHint")}</p>
          </div>
        </div>
      ) : null}

      {isCreate && samplePreview ? (
        <div className="border-border bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
          <p className="font-medium">{t("sampleSizeSummaryTitle")}</p>
          <p className="text-muted-foreground">
            {t("sampleSizeSummaryBody", {
              population,
              marginPct: Math.round(marginOfError * 100),
              requiredSampleSize: samplePreview.requiredSampleSize,
              mde: samplePreview.minimumDetectableEffect.toFixed(1),
            })}
          </p>
        </div>
      ) : null}

      {!isCreate && study ? (
        <div className="space-y-2">
          <Label>{t("cycleNumberLabel")}</Label>
          <Input value={study.cycleNumber} readOnly disabled />
        </div>
      ) : null}

      {!isCreate && study && study.requiredSampleSize != null ? (
        <div className="border-border bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
          <p className="font-medium">{t("sampleSizeSummaryTitle")}</p>
          <p className="text-muted-foreground">
            {t("sampleSizeSummaryBody", {
              population: study.population ?? 0,
              marginPct:
                study.marginOfError != null ? Math.round(study.marginOfError * 100) : "—",
              requiredSampleSize: study.requiredSampleSize,
              mde: study.minimumDetectableEffect?.toFixed(1) ?? "—",
            })}
          </p>
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
        >
          {submitError}
        </div>
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
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
