"use client";

import { Lock, MapPin, Pencil, Trash2, UploadCloud } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AiClassificationSection } from "@/components/features/studies/ai-classification-section";
import { NeedSummarySection } from "@/components/features/studies/need-summary-section";
// Commented out with its usage below — see the note at the mount site.
import { NeedPriorityInputs } from "@/components/features/studies/need-priority-inputs";
import { NeedInitiativeLinkSection } from "@/components/features/studies/need-initiative-link-section";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { DeleteNeedDialog } from "@/components/features/studies/delete-need-dialog";
import { NeedStatusBadge } from "@/components/features/studies/study-status-badge";
import { BackButton } from "@/components/common/back-button";
import { GovernoratePicker } from "@/components/common/governorate-picker";
import { LoadingButton } from "@/components/common/loading-button";
import { MultiSelect } from "@/components/ui/multi-select";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutoTranslate } from "@/hooks/use-auto-translate";
import { usePermission } from "@/hooks/use-permission";
import { useStudyGovernorates, useStudyCenters } from "@/hooks/use-study-geography";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { evidenceService } from "@/services/evidence/evidence.service";
import { needsService } from "@/services/needs/needs.service";
import { NEED_EDITABLE_STATUSES, type Need } from "@/services/needs/needs.types";
import type { Governorate, Center } from "@/services/geography/geography.types";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format-date";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";

interface NeedFormValues {
  title: string;
  statement: string;
  village: string[];
  governorateIds: string[];
  centerIds: string[];
  // A string, not a number — see the create form's own note: an emptied field
  // must stay distinguishable from zero, because clearing the estimate and
  // recording "nobody is affected" are different statements.
  affectedPopulation: string;
  affectedPeople: string;
  affectedHouseholds: string;
}

const MAX_AFFECTED_POPULATION = 50_000_000;

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
          <AutoTranslate text={village} />
        </Badge>
      ))}
    </div>
  );
}

// dir="auto" lets the browser pick this block's own direction from its
// actual first strong-directional character, instead of inheriting the
// page's RTL — free-form content (statements, notes) can be in either
// language regardless of UI locale, and without this, English text ending
// in punctuation visually reorders (the trailing "." or "?" jumps to the
// start of the line) inside an RTL-directioned ancestor.
function FilledTextBlock({ children }: { children: ReactNode }) {
  return (
    <div
      dir="auto"
      className="border-border bg-muted/40 min-h-24 rounded-md border px-3.5 py-3 text-sm whitespace-pre-wrap"
    >
      {children}
    </div>
  );
}

function FilledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="border-border bg-muted/40 rounded-md border px-3.5 py-2 text-sm">
        {children}
      </div>
    </div>
  );
}

type StepState = "not_started" | "in_progress" | "completed";

const STEP_BADGE_CLASS: Record<StepState, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-badge-warning text-badge-warning-foreground",
  completed: "bg-badge-success text-badge-success-foreground",
};

function WorkflowStep({
  icon,
  title,
  state,
  stateLabel,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  state: StepState;
  stateLabel: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <div className="bg-primary/5 border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="text-foreground flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
            {icon}
          </span>
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border-transparent", STEP_BADGE_CLASS[state])}>
            {stateLabel}
          </Badge>
          {action}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/** Need statement/village/source — editable inline while still `draft`;
 * every later stage has downstream artifacts an edit would invalidate, so
 * it becomes a read-only summary instead. */
function NeedDetailsCard({
  need,
  canEdit,
  studyGovernorates,
  studyCenters,
  onSaved,
  onDeleted,
}: {
  need: Need;
  canEdit: boolean;
  studyGovernorates: Governorate[];
  studyCenters: Center[];
  onSaved: (need: Need) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("app.studies.need");
  const tGeo = useTranslations("app.geography");
  const tSource = useTranslations("app.studies.source");
  const tDelete = useTranslations("app.studies.need.delete");
  const tValidation = useTranslations("app.studies.validation");
  const locale = useLocale() as AppLocale;
  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, tValidation("titleRequired"))
      .max(300, tValidation("titleTooLong")),
    statement: z.string().trim().min(1, tValidation("needStatementRequired")),
    village: z.array(z.string()),
    governorateIds: z.array(z.string()),
    centerIds: z.array(z.string()),
    affectedPopulation: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= MAX_AFFECTED_POPULATION),
        tValidation("affectedPopulationInvalid"),
      ),
    // RIO-FR-005 (Round 4, client-confirmed 2026-08-24) — kept as strings on
    // the form so an empty field round-trips as "" rather than NaN.
    affectedPeople: z
      .string()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0),
        tValidation("affectedPopulationInvalid"),
      ),
    affectedHouseholds: z
      .string()
      .refine(
        (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0),
        tValidation("affectedPopulationInvalid"),
      ),
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
      title: need.title,
      statement: need.statement,
      village: need.village,
      governorateIds: need.governorateIds,
      centerIds: need.centerIds,
      affectedPopulation:
        need.affectedPopulation === null ? "" : String(need.affectedPopulation),
      affectedPeople: need.affectedPeople === null ? "" : String(need.affectedPeople),
      affectedHouseholds:
        need.affectedHouseholds === null ? "" : String(need.affectedHouseholds),
    },
  });

  const village = useWatch({ control, name: "village" });
  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });
  const centerOptions = studyCenters.filter((c) =>
    governorateIds.includes(c.governorateId),
  );
  // The selected governorate(s) have no centers configured at all — hide
  // the field rather than show a dead, always-empty dropdown.
  const centerFieldHidden = governorateIds.length > 0 && centerOptions.length === 0;

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const updated = await needsService.update(need.id, {
        title: values.title,
        statement: values.statement,
        village: values.village,
        governorateIds: values.governorateIds,
        centerIds: values.centerIds,
        // Emptied means "clear the estimate", which the API takes as an
        // explicit null — omitting the key would silently leave the old value
        // in place while the form showed it as gone.
        affectedPopulation:
          values.affectedPopulation === "" ? null : Number(values.affectedPopulation),
        affectedPeople:
          values.affectedPeople === "" ? null : Number(values.affectedPeople),
        affectedHouseholds:
          values.affectedHouseholds === "" ? null : Number(values.affectedHouseholds),
      });
      onSaved(updated);
      setEditing(false);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    }
  });

  const locked = !NEED_EDITABLE_STATUSES.includes(need.status);

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground min-w-0 truncate text-sm font-semibold">
            <AutoTranslate text={need.title} />
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <NeedStatusBadge status={need.status} />
            {canEdit && !locked && !editing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5" />
                {t("editNeed")}
              </Button>
            ) : null}
            {canEdit && !locked ? (
              <DeleteNeedDialog
                needId={need.id}
                onDeleted={onDeleted}
                trigger={
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                      {tDelete("action")}
                    </Button>
                  </AlertDialogTrigger>
                }
              />
            ) : null}
          </div>
        </div>

        {locked ? (
          <div
            role="status"
            className="bg-muted text-muted-foreground flex items-start gap-2 rounded-md border p-3 text-sm"
          >
            <Lock className="mt-0.5 size-4 shrink-0" />
            {/* One message per actual status — "reviewed" is only true once
             * a reviewer has actually approved (reviewer_approved or later);
             * evidence_submitted/ai_classified are locked too but for a
             * different, still-in-progress reason, so they need their own
             * wording rather than a blanket "reviewed" claim. */}
            <span>{t(`lockedNotice.${need.status}`)}</span>
          </div>
        ) : null}

        {editing ? (
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input id="title" {...register("title")} />
              {errors.title ? (
                <p className="text-destructive text-sm">{errors.title.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="statement">{t("statementLabel")}</Label>
              <textarea
                id="statement"
                rows={5}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                {...register("statement")}
              />
              {errors.statement ? (
                <p className="text-destructive text-sm">{errors.statement.message}</p>
              ) : null}
            </div>

            {/* Governorates/Centers scoped to the Study's own selection,
                side by side; Village (free text) comes after Center. Center
                is hidden outright (not just disabled) once a governorate is
                chosen that has no centers configured under it — an empty,
                unusable dropdown would otherwise block the usual flow. */}
            <div
              className={centerFieldHidden ? "grid gap-5" : "grid gap-5 sm:grid-cols-2"}
            >
              <div className="space-y-2">
                <Label>{tGeo("governorateLabel")}</Label>
                <MultiSelect
                  options={studyGovernorates.map((g) => ({ value: g.id, label: g.name }))}
                  values={governorateIds}
                  onChange={(next) => {
                    setValue("governorateIds", next, { shouldValidate: true });
                    // Dropping a governorate must also drop any already-selected
                    // centers that belonged to it — otherwise centerIds keeps an
                    // orphaned id centerOptions no longer contains, and the
                    // MultiSelect can't resolve a label for it (falls back to
                    // showing the raw id, as if it were a real selection).
                    const stillValidCenterIds = new Set(
                      studyCenters
                        .filter((c) => next.includes(c.governorateId))
                        .map((c) => c.id),
                    );
                    setValue(
                      "centerIds",
                      centerIds.filter((id) => stillValidCenterIds.has(id)),
                      { shouldValidate: true },
                    );
                  }}
                  placeholder={tGeo("governoratePlaceholder")}
                  searchPlaceholder={tGeo("governorateSearchPlaceholder")}
                  emptyText={tGeo("governorateEmpty")}
                  removeAriaLabel={(governorate) =>
                    tGeo("removeGovernorateSelection", { governorate })
                  }
                />
              </div>

              {centerFieldHidden ? null : (
                <div className="space-y-2">
                  <Label>{tGeo("centerLabel")}</Label>
                  <MultiSelect
                    options={centerOptions.map((c) => ({ value: c.id, label: c.name }))}
                    values={centerIds}
                    onChange={(next) =>
                      setValue("centerIds", next, { shouldValidate: true })
                    }
                    placeholder={
                      governorateIds.length > 0
                        ? tGeo("centerPlaceholder")
                        : tGeo("selectGovernorateFirst")
                    }
                    searchPlaceholder={tGeo("centerSearchPlaceholder")}
                    emptyText={tGeo("centerEmpty")}
                    removeAriaLabel={(center) =>
                      tGeo("removeCenterSelection", { center })
                    }
                    disabled={governorateIds.length === 0}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="village">{t("villageLabel")}</Label>
              <GovernoratePicker
                values={village ?? []}
                options={[]}
                onChange={(next) => setValue("village", next, { shouldValidate: true })}
              />
              {errors.village ? (
                <p className="text-destructive text-sm">{errors.village.message}</p>
              ) : null}
            </div>

            {/* Editable after the fact so a better estimate can replace a first
                guess — but it can only ever be ANSWERED here, never derived:
                nothing else in the platform knows how many people one need
                affects. See the create form's note. */}
            <div className="space-y-2">
              <Label htmlFor="affectedPopulation">{t("affectedPopulationLabel")}</Label>
              <Input
                id="affectedPopulation"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_AFFECTED_POPULATION}
                step={1}
                placeholder={t("affectedPopulationPlaceholder")}
                {...register("affectedPopulation")}
              />
              <p className="text-muted-foreground text-xs">
                {t("affectedPopulationHint")}
              </p>
              {errors.affectedPopulation ? (
                <p className="text-destructive text-sm">
                  {errors.affectedPopulation.message}
                </p>
              ) : null}
            </div>

            {/* RIO-FR-005 (Round 4, client-confirmed 2026-08-24) — the
                manually entered figure is the PRIMARY Affected Population
                value; both are optional and independent. */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="affectedPeople">{t("affectedPeopleLabel")}</Label>
                <Input
                  id="affectedPeople"
                  type="number"
                  min={0}
                  placeholder={t("affectedPeoplePlaceholder")}
                  {...register("affectedPeople")}
                />
                {errors.affectedPeople ? (
                  <p className="text-destructive text-sm">
                    {errors.affectedPeople.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="affectedHouseholds">{t("affectedHouseholdsLabel")}</Label>
                <Input
                  id="affectedHouseholds"
                  type="number"
                  min={0}
                  placeholder={t("affectedHouseholdsPlaceholder")}
                  {...register("affectedHouseholds")}
                />
                {errors.affectedHouseholds ? (
                  <p className="text-destructive text-sm">
                    {errors.affectedHouseholds.message}
                  </p>
                ) : null}
              </div>
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
                onClick={() => setEditing(false)}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">
                {t("statementLabel")}
              </p>
              <FilledTextBlock>
                <AutoTranslate text={need.statement} />
              </FilledTextBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilledField label={tGeo("governorateLabel")}>
                {need.governorateIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {need.governorateIds.map((id) => (
                      <Badge key={id} variant="secondary">
                        {studyGovernorates.find((g) => g.id === id)?.name ?? id}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </FilledField>
              <FilledField label={tGeo("centerLabel")}>
                {need.centerIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {need.centerIds.map((id) => (
                      <Badge key={id} variant="secondary">
                        {studyCenters.find((c) => c.id === id)?.name ?? id}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </FilledField>
              <FilledField label={t("villageLabel")}>
                <VillageChips villages={need.village} />
              </FilledField>
              <FilledField label={t("affectedPopulationLabel")}>
                {/* A dash means no estimate was given — not zero people. Same
                    distinction the Top-Priority Report's column makes. */}
                {need.affectedPopulation === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatNumber(need.affectedPopulation, locale)
                )}
              </FilledField>
              <FilledField label={t("affectedPeopleLabel")}>
                {need.affectedPeople === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatNumber(need.affectedPeople, locale)
                )}
              </FilledField>
              <FilledField label={t("affectedHouseholdsLabel")}>
                {need.affectedHouseholds === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatNumber(need.affectedHouseholds, locale)
                )}
              </FilledField>
              <FilledField label={t("systemReferenceIdLabel")}>
                <span className="font-mono">{need.internalReferenceId}</span>
              </FilledField>
              <FilledField label={t("sourceLabel")}>{tSource(need.source)}</FilledField>
              <FilledField label={t("enteredByLabel")}>
                {need.createdByName ?? t("enteredByUnknown")}
              </FilledField>
              <FilledField label={t("captureDateLabel")}>
                <FormattedDate value={need.createdAt} withTime />
              </FilledField>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NeedWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; needId: string }>;
}) {
  const { id: studyId, needId } = use(params);
  const t = useTranslations("app.studies.detail");
  const router = useRouter();
  const canEdit = usePermission("dataCollection", "write");
  const canViewEvidence = usePermission("dataCollection", "read");
  const canViewInitiatives = usePermission("initiatives", "read");
  const canManageInitiativeLinks = usePermission("initiatives", "write");

  const [need, setNeed] = useState<Need | null>(null);
  // Dynamic AI translation (Approach 3 hybrid) — the page header takes a
  // plain string, not a node, so this is read via the hook rather than the
  // <AutoTranslate> component used further down for the statement.
  const translatedTitle = useAutoTranslate(need?.title).text;
  const [study, setStudy] = useState<Study | null>(null);
  // Distinct from `study` itself — a failed fetch must still let the page
  // render (with governorates/centers falling back to empty) instead of
  // leaving the skeleton up forever waiting for a `study` that never arrives.
  const [studyLoadFailed, setStudyLoadFailed] = useState(false);
  const studyGovernorates = useStudyGovernorates(study);
  const studyCenters = useStudyCenters(study);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [notFound, setNotFound] = useState(false);
  // One-time notice for the Create Need form's best-effort evidence upload
  // (see studies/[id]/needs/new/page.tsx) — a failed upload there never
  // blocks navigating here, so it's surfaced here instead of being lost.
  // Read via a lazy initializer (not an effect) since this only needs to
  // happen once, synchronously, at mount — needId is already known by then.
  const [failedEvidenceNames] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const key = `rio.needEvidenceUploadFailed.${needId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    sessionStorage.removeItem(key);
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  });

  const refreshNeed = () => {
    needsService
      .getById(needId)
      .then(setNeed)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
      });
  };

  useEffect(() => {
    refreshNeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId]);

  useEffect(() => {
    studiesService
      .getById(studyId)
      .then(setStudy)
      .catch(() => setStudyLoadFailed(true));
  }, [studyId]);

  useEffect(() => {
    evidenceService
      .listByNeed(needId)
      .then((list) => setEvidenceCount(list.length))
      .catch(() => undefined);
  }, [needId]);

  if (notFound) {
    return (
      <PermissionGuard module="dataCollection" action="read">
        <PageContainer>
          <div className="mb-6 flex justify-start">
            <BackButton href={`/studies/${studyId}`} label={t("backToList")} />
          </div>
          <PageHeader title={t("needNotFound")} />
        </PageContainer>
      </PermissionGuard>
    );
  }

  if (need === null || (study === null && !studyLoadFailed)) {
    // Wait for both before rendering real content — Need and Study/
    // Governorates/Centers load independently, and rendering as soon as
    // just `need` arrived would flash the Governorate/Center chips empty
    // (still resolving from `study`) before they populate a beat later.
    return (
      <PermissionGuard module="dataCollection" action="read">
        <PageContainer>
          <div className="space-y-4">
            <div className="bg-muted h-8 w-64 rounded" />
            <div className="bg-muted h-40 w-full rounded" />
          </div>
        </PageContainer>
      </PermissionGuard>
    );
  }

  const evidenceState: StepState =
    evidenceCount === 0
      ? "not_started"
      : NEED_EDITABLE_STATUSES.includes(need.status)
        ? "in_progress"
        : "completed";

  return (
    <PermissionGuard module="dataCollection" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href={`/studies/${studyId}`} label={t("backToStudy")} />
        </div>
        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          {t("needEyebrow")}
        </p>
        <PageHeader title={translatedTitle} />

        {failedEvidenceNames.length > 0 ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/5 mt-4 flex items-start gap-2.5 rounded-md border p-3.5"
          >
            <div className="space-y-1">
              <p className="text-destructive text-sm font-medium">
                {t("evidenceUploadFailedTitle")}
              </p>
              <p className="text-foreground text-sm">
                {t("evidenceUploadFailedNames", {
                  names: failedEvidenceNames.join(", "),
                })}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          <NeedDetailsCard
            need={need}
            canEdit={canEdit}
            studyGovernorates={studyGovernorates}
            studyCenters={studyCenters}
            onSaved={setNeed}
            onDeleted={() => router.push(`/studies/${studyId}`)}
          />

          {canViewEvidence ? (
            <WorkflowStep
              icon={<UploadCloud className="size-3.5" />}
              title={t("evidenceHeading")}
              state={evidenceState}
              stateLabel={t(`stepState.${evidenceState}`)}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    router.push(`/studies/${studyId}/needs/${needId}/evidence`)
                  }
                >
                  <UploadCloud className="size-3.5" />
                  {t("manageEvidence")}
                </Button>
              }
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                    evidenceCount > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {evidenceCount}
                </span>
                <p className="text-foreground text-sm font-medium">
                  {t("evidenceCount", { count: evidenceCount })}
                </p>
              </div>
            </WorkflowStep>
          ) : null}

          {/* RIO-AI-003 — renders nothing when the description was short
              enough not to be summarised, which is the common case.
              Keyed on the need id so moving to another need mounts a fresh
              panel rather than briefly showing the previous need's summary. */}
          {/* RIO-FR-003 AC 1 — urgency. Restored 31 Aug after checking the
              workbook: urgency IS approved methodology (BRD - Priority
              Scoring, factor 4, "Approved baseline - configurable during
              implementation"), unlike themes, which appear nowhere in it.
              The themes half of this panel stays hidden — see the component. */}
          <NeedPriorityInputs need={need} onNeedUpdated={setNeed} />

          {canViewInitiatives ? (
            <NeedInitiativeLinkSection
              need={need}
              canManage={canManageInitiativeLinks}
              onNeedUpdated={setNeed}
            />
          ) : null}

          <NeedSummarySection key={need.id} needId={need.id} />

          <AiClassificationSection need={need} onNeedUpdated={setNeed} />
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}
