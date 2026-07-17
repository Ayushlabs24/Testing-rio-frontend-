"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api/types";
import type { Study } from "@/services/studies/studies.types";

export interface StudyFormValues {
  title: string;
  problemStatement: string;
  /**
   * Create-only. Free text, comma-separated — the caller splits it into
   * Study.villages before sending (see parseVillageInput).
   */
  village: string;
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

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(300, tValidation("titleTooLong")),
    problemStatement: isCreate
      ? z.string().trim().min(1, "Problem statement is required")
      : z.string().optional(),
    village: z.string(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: study?.title ?? "", problemStatement: "", village: "" },
  });

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

      {isCreate ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="problemStatement">Problem Statement / Study About</Label>
            <textarea
              id="problemStatement"
              rows={4}
              placeholder="Provide a detailed problem statement..."
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register("problemStatement")}
            />
            {errors.problemStatement ? (
              <p className="text-destructive text-sm">{(errors.problemStatement as any).message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="village">{t("villageLabel")}</Label>
            <Input
              id="village"
              placeholder={t("villagePlaceholder")}
              {...register("village")}
            />
            <p className="text-muted-foreground text-xs">{t("villageHint")}</p>
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
