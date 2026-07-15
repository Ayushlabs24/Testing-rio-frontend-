"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/services/api/types";
import type {
  SelectableStudyStatus,
  Study,
  StudyStatus,
} from "@/services/studies/studies.types";

/**
 * Mirrors the backend's forward-only lifecycle. Offering a transition the
 * server would reject with a 409 is a worse experience than not offering it,
 * so the options a user sees are always the ones that will succeed.
 */
const NEXT_STATUSES: Record<StudyStatus, readonly SelectableStudyStatus[]> = {
  draft: ["draft", "active"],
  active: ["active", "completed"],
  completed: ["completed"],
  archived: [],
};

export interface StudyFormValues {
  title: string;
  description: string;
  needStatement: string;
  villages: string[];
  status?: SelectableStudyStatus;
}

interface StudyFormProps {
  /** Omit to create; pass a study to edit. */
  study?: Study;
  onSubmit: (values: StudyFormValues) => Promise<void>;
  onCancel: () => void;
}

export function StudyForm({ study, onSubmit, onCancel }: StudyFormProps) {
  const t = useTranslations("app.studies.form");
  const tValidation = useTranslations("app.studies.validation");
  const { session } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const orgVillages = session?.organization.villages ?? [];
  const isEdit = study !== undefined;

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(200, tValidation("titleTooLong")),
    description: z.string().max(2000, tValidation("descriptionTooLong")),
    needStatement: z.string(),
    villages: z.array(z.string()),
    status: z.enum(["draft", "active", "completed"]).optional(),
  });

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StudyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: study?.title ?? "",
      description: study?.description ?? "",
      needStatement: study?.needStatement ?? "",
      villages: study?.villages ?? [],
      status: (study?.status ?? "draft") as SelectableStudyStatus,
    },
  });

  // useWatch, not watch(): the latter can't be memoized safely and opts the
  // component out of compilation. Matches the organization/users forms.
  const selectedVillages = useWatch({ control, name: "villages" });
  const currentStatus = useWatch({ control, name: "status" });
  const statusOptions = NEXT_STATUSES[study?.status ?? "draft"];

  const toggleVillage = (village: string, checked: boolean) => {
    const next = checked
      ? [...selectedVillages, village]
      : selectedVillages.filter((v) => v !== village);
    setValue("villages", next, { shouldDirty: true });
  };

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      // The backend's message is the useful one here — VILLAGE_NOT_IN_SCOPE
      // names the offending village, INVALID_STATUS_TRANSITION names both ends.
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
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <Input
          id="description"
          placeholder={t("descriptionPlaceholder")}
          {...register("description")}
        />
        {errors.description ? (
          <p className="text-destructive text-sm">{errors.description.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="needStatement">{t("needStatementLabel")}</Label>
        <textarea
          id="needStatement"
          rows={5}
          placeholder={t("needStatementPlaceholder")}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          {...register("needStatement")}
        />
        <p className="text-muted-foreground text-xs">{t("needStatementHelp")}</p>
      </div>

      <div className="space-y-2">
        <Label>{t("villagesLabel")}</Label>
        {orgVillages.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("villagesEmpty")}</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {orgVillages.map((village) => (
                <label key={village} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedVillages.includes(village)}
                    onCheckedChange={(checked) =>
                      toggleVillage(village, checked === true)
                    }
                  />
                  {village}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">{t("villagesHelp")}</p>
          </>
        )}
      </div>

      {isEdit && statusOptions.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="status">{t("statusLabel")}</Label>
          <Select
            value={currentStatus}
            onValueChange={(value) =>
              setValue("status", value as SelectableStudyStatus, { shouldDirty: true })
            }
          >
            <SelectTrigger id="status" className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  <StatusLabel value={value} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">{t("statusHelp")}</p>
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

function StatusLabel({ value }: { value: SelectableStudyStatus }) {
  const t = useTranslations("app.studies.status");
  return <>{t(value)}</>;
}
