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
import { ApiError } from "@/services/api/types";
import type { Governorate } from "@/services/geography/geography.types";
import type { MethodologyVersion } from "@/services/priority/severity-scoring.service";
import type { Study } from "@/services/studies/studies.types";

export interface StudyFormValues {
  title: string;
  /** Mandatory subset of the org's own selected Governorates. */
  governorateIds: string[];
  /** Mandatory subset of the org's own selected Centers, filtered by
   * `governorateIds`. */
  centerIds: string[];
  /** Optional link to a PUBLISHED MethodologyVersion. */
  methodologyVersionId: string | null;
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
  onSubmit: (values: StudyFormValues) => Promise<void>;
  onCancel: () => void;
}

export function StudyForm({
  study,
  orgGovernorates,
  regionName,
  methodologyVersions,
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
    methodologyVersionId: z.string().nullable(),
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
      methodologyVersionId: study?.methodologyVersionId ?? null,
    },
  });

  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });
  const methodologyVersionId = useWatch({ control, name: "methodologyVersionId" });

  const { centers: orgCenters, loaded: orgCentersLoaded } =
    useOrgCentersForGovernorates(governorateIds);

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
        <Label htmlFor="title">{t("titleLabel")}</Label>
        <Input id="title" placeholder={t("titlePlaceholder")} {...register("title")} />
        {errors.title ? (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>{t("regionLabel")}</Label>
        <Input value={regionName} readOnly disabled />
        <p className="text-muted-foreground text-sm">{t("regionHint")}</p>
      </div>

      <div className="space-y-2">
        <Label>{t("governorateLabel")}</Label>
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
        <Label>{t("centerLabel")}</Label>
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

      <div className="space-y-2">
        <Label>{t("methodologyVersionLabel")}</Label>
        <Select
          value={methodologyVersionId ?? "none"}
          onValueChange={(value) =>
            setValue("methodologyVersionId", value === "none" ? null : value)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("methodologyVersionPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("methodologyVersionNone")}</SelectItem>
            {methodologyVersions.map((mv) => (
              <SelectItem key={mv.id} value={mv.id}>
                {mv.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isCreate && study ? (
        <div className="space-y-2">
          <Label>{t("cycleNumberLabel")}</Label>
          <Input value={study.cycleNumber} readOnly disabled />
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
