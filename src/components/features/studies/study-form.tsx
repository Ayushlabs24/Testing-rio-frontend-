"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api/types";
import { studiesService } from "@/services/studies/studies.service";
import type { AssignableReviewer, Study } from "@/services/studies/studies.types";

export interface StudyFormValues {
  title: string;
  /**
   * Create-only. Free text, comma-separated — the caller splits it into
   * Study.villages before sending (see parseVillageInput).
   */
  village: string;
  /**
   * Create-only. Empty string = no reviewer selected. Required only when
   * the org has at least one active Reviewer/Approver (human_reviewer) to
   * assign — same rule the backend enforces, checked here against the same
   * fetched list so the message shows up before a round trip.
   */
  assignedReviewerId: string;
}

interface StudyFormProps {
  /** Omit to create; pass a study to edit. Title is the only field an edit
   * can change — Villages are set at create; Need/Evidence/Classification
   * each live on their own screen. */
  study?: Study;
  onSubmit: (values: StudyFormValues) => Promise<void>;
  onCancel: () => void;
}

export function StudyForm({ study, onSubmit, onCancel }: StudyFormProps) {
  const t = useTranslations("app.studies.form");
  const tValidation = useTranslations("app.studies.validation");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isCreate = study === undefined;

  const [reviewers, setReviewers] = useState<AssignableReviewer[] | null>(null);
  const [reviewersLoadFailed, setReviewersLoadFailed] = useState(false);

  useEffect(() => {
    if (!isCreate) return;
    studiesService
      .listAssignableReviewers()
      .then((rows) => {
        setReviewers(rows);
        setReviewersLoadFailed(false);
      })
      .catch(() => {
        setReviewers([]);
        setReviewersLoadFailed(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewerRequired = isCreate && (reviewers?.length ?? 0) > 0;

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(300, tValidation("titleTooLong")),
    village: z.string(),
    assignedReviewerId: z.string(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StudyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: study?.title ?? "", village: "", assignedReviewerId: "" },
  });

  const assignedReviewerId = useWatch({ control, name: "assignedReviewerId" });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    if (reviewerRequired && !values.assignedReviewerId) {
      setError("assignedReviewerId", {
        message: tValidation("assignedReviewerRequired"),
      });
      return;
    }
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

      {isCreate ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="village">{t("villageLabel")}</Label>
            <Input
              id="village"
              placeholder={t("villagePlaceholder")}
              {...register("village")}
            />
            <p className="text-muted-foreground text-xs">{t("villageHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned-reviewer">
              {t("assignedReviewerLabel")}
              {reviewerRequired ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Combobox
              items={(reviewers ?? []).map((r) => ({
                value: r.id,
                label: r.name,
                description: r.email,
              }))}
              value={assignedReviewerId || null}
              onSelect={(value) =>
                setValue("assignedReviewerId", value, { shouldValidate: true })
              }
              loading={reviewers === null}
              disabled={reviewers !== null && reviewers.length === 0}
              placeholder={
                reviewers !== null && reviewers.length === 0
                  ? t("assignedReviewerNoneAvailable")
                  : t("assignedReviewerPlaceholder")
              }
              searchPlaceholder={t("assignedReviewerSearchPlaceholder")}
              emptyText={t("assignedReviewerEmpty")}
              aria-label={t("assignedReviewerLabel")}
            />
            {errors.assignedReviewerId ? (
              <p className="text-destructive text-sm">
                {errors.assignedReviewerId.message}
              </p>
            ) : reviewersLoadFailed ? (
              <p className="text-destructive text-sm">{t("assignedReviewerLoadError")}</p>
            ) : null}
          </div>
        </>
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("saving") : t("save")}
        </Button>
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
