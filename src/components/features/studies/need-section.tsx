"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, MapPin, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { LoadingButton } from "@/components/common/loading-button";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseVillageInput } from "@/lib/villages";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import { needLockState, type Need } from "@/services/needs/needs.types";
import type { StudyStatus } from "@/services/studies/studies.types";

interface NeedFormValues {
  title: string;
  statement: string;
  village: string[];
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

function FilledTextBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-muted/40 min-h-24 rounded-md border px-3.5 py-3 text-sm whitespace-pre-wrap">
      {children}
    </div>
  );
}

function FilledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="border-border bg-muted/40 rounded-md border px-3.5 py-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function VillageChips({ villages }: { villages: string[] }) {
  const t = useTranslations("app.studies.detail");
  if (villages.length === 0) {
    return <span className="text-muted-foreground text-sm">{t("noVillage")}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {villages.map((village) => (
        <Badge key={village} variant="secondary" className="gap-1">
          <MapPin className="size-3" />
          {village}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Study Detail's Need section — the create/edit form lives right here now,
 * inline, instead of navigating to a separate `/studies/[id]/need` route.
 * Toggled open (a) automatically when there's no Need yet, so a fresh Study
 * always shows a ready-to-fill form rather than an empty state plus another
 * click, or (b) via the Edit button once one exists.
 */
export function NeedSection({
  studyId,
  studyStatus,
  studyVillages,
  need,
  canEdit: canCapture,
  prefillVillage,
  onSaved,
}: {
  studyId: string;
  studyStatus: StudyStatus;
  studyVillages: string[];
  need: Need | null;
  /** Permission to create/edit a Need at all (dataCollection:create). */
  canEdit: boolean;
  prefillVillage?: string;
  onSaved: (need: Need) => void;
}) {
  const t = useTranslations("app.studies.need");
  const td = useTranslations("app.studies.detail");
  const tValidation = useTranslations("app.studies.validation");
  const { session } = useAuth();

  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lockState = needLockState(studyStatus, session?.role.key);
  const canEdit = canCapture && lockState === "editable";
  // A brand-new Need can always be captured once (mirrors the backend: there
  // is no lock check on create, only on editing one that already exists) —
  // so the form auto-opens whenever there's no Need yet, regardless of the
  // Study's current lock state.
  const isFormOpen = canCapture && (editing || !need);

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(300, tValidation("titleTooLong")),
    statement: z.string().trim().min(1, tValidation("needStatementRequired")),
    village: z.array(z.string()).min(1, tValidation("needVillageRequired")),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NeedFormValues>({
    resolver: zodResolver(schema),
    values: {
      title: need?.title ?? "",
      statement: need?.statement ?? "",
      village:
        need?.village ??
        (prefillVillage ? parseVillageInput(prefillVillage) : studyVillages),
    },
  });

  const village = useWatch({ control, name: "village" });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const saved = need
        ? await needsService.update(studyId, values)
        : await needsService.create(studyId, values);
      setEditing(false);
      onSaved(saved);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    }
  });

  const cancelEdit = () => {
    setEditing(false);
    setSubmitError(null);
    reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-foreground text-sm font-semibold">{td("needHeading")}</h2>
        <div className="flex items-center gap-2">
          <Badge
            className={
              need
                ? "bg-badge-success text-badge-success-foreground border-transparent"
                : "bg-muted text-muted-foreground border-transparent"
            }
          >
            {need ? td("stepState.completed") : td("stepState.not_started")}
          </Badge>
          {canEdit && need && !isFormOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
              {td("editNeed")}
            </Button>
          ) : null}
        </div>
      </div>

      {isFormOpen ? (
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
              onChange={(next) => setValue("village", next, { shouldValidate: true })}
            />
            {errors.village ? (
              <p className="text-destructive text-sm">{errors.village.message}</p>
            ) : null}
          </div>

          {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}

          <div className="flex items-center gap-2">
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              text={isSubmitting ? t("saving") : t("save")}
            />
            {need ? (
              <Button
                type="button"
                variant="outline"
                onClick={cancelEdit}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : need ? (
        <div className="space-y-4">
          {lockState !== "editable" ? (
            <div
              role="status"
              className="bg-muted text-muted-foreground flex items-start gap-2 rounded-md border p-3 text-sm"
            >
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                {lockState === "locked" ? t("lockedNotice") : t("reviewerOnlyNotice")}
              </span>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">
              {td("needStatementLabel")}
            </p>
            <FilledTextBlock>{need.statement}</FilledTextBlock>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FilledField label={td("needVillageLabel")}>
              <VillageChips villages={need.village} />
            </FilledField>
            <FilledField label={td("needSourceLabel")}>{need.source}</FilledField>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{td("needEmpty")}</p>
      )}
    </div>
  );
}
