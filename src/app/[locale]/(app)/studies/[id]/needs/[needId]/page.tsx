"use client";

import { ArrowLeft, Lock, MapPin, Pencil, Trash2, UploadCloud, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AiClassificationSection } from "@/components/features/studies/ai-classification-section";
import { DeleteNeedDialog } from "@/components/features/studies/delete-need-dialog";
import { NeedStatusBadge } from "@/components/features/studies/study-status-badge";
import { SurveyStatusCard } from "@/components/features/studies/survey-status-card";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { parseVillageInput } from "@/lib/villages";
import { ApiError } from "@/services/api/types";
import { evidenceService } from "@/services/evidence/evidence.service";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";

interface NeedFormValues {
  title: string;
  statement: string;
  village: string[];
  source: string;
  referenceId: string;
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

function FilledTextBlock({ children }: { children: ReactNode }) {
  return (
    <div className="border-border bg-muted/40 min-h-24 rounded-md border px-3.5 py-3 text-sm whitespace-pre-wrap">
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
      <div className="bg-primary/5 border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
            {icon}
          </span>
          {title}
        </h2>
        <div className="flex items-center gap-2">
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
  onSaved,
  onDeleted,
}: {
  need: Need;
  canEdit: boolean;
  onSaved: (need: Need) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("app.studies.need");
  const tDelete = useTranslations("app.studies.need.delete");
  const tValidation = useTranslations("app.studies.validation");
  const [editing, setEditing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    values: {
      title: need.title,
      statement: need.statement,
      village: need.village,
      source: need.source,
      referenceId: need.referenceId ?? "",
    },
  });

  const village = useWatch({ control, name: "village" });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const updated = await needsService.update(need.id, {
        title: values.title,
        statement: values.statement,
        village: values.village,
        source: values.source,
        referenceId: values.referenceId.trim() || null,
      });
      onSaved(updated);
      setEditing(false);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    }
  });

  const locked = need.status !== "draft";

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            {need.title}
          </h2>
          <div className="flex items-center gap-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source">{t("sourceLabel")}</Label>
                <Input id="source" {...register("source")} />
                {errors.source ? (
                  <p className="text-destructive text-sm">{errors.source.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceId">{t("referenceIdLabel")}</Label>
                <Input id="referenceId" {...register("referenceId")} />
                {errors.referenceId ? (
                  <p className="text-destructive text-sm">{errors.referenceId.message}</p>
                ) : null}
              </div>
            </div>
            {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("saving") : t("save")}
              </Button>
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
              <FilledTextBlock>{need.statement}</FilledTextBlock>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilledField label={t("villageLabel")}>
                <VillageChips villages={need.village} />
              </FilledField>
              <FilledField label={t("sourceLabel")}>{need.source}</FilledField>
            </div>
            {need.referenceId ? (
              <FilledField label={t("referenceIdLabel")}>{need.referenceId}</FilledField>
            ) : null}
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
  const canUseSurveyBuilder = usePermission("surveyBuilder", "read");

  const [need, setNeed] = useState<Need | null>(null);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [notFound, setNotFound] = useState(false);

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
    evidenceService
      .listByNeed(needId)
      .then((list) => setEvidenceCount(list.length))
      .catch(() => undefined);
  }, [needId]);

  if (notFound) {
    return (
      <PermissionGuard module="dataCollection" action="read">
        <PageContainer>
          <PageHeader title={t("needNotFound")} />
          <Button variant="outline" onClick={() => router.push(`/studies/${studyId}`)} className="gap-2">
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Button>
        </PageContainer>
      </PermissionGuard>
    );
  }

  if (need === null) {
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
    evidenceCount === 0 ? "not_started" : need.status === "draft" ? "in_progress" : "completed";

  return (
    <PermissionGuard module="dataCollection" action="read">
      <PageContainer>
        <Link
          href={`/studies/${studyId}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {t("backToStudy")}
        </Link>

        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          {t("needEyebrow")}
        </p>
        <PageHeader title={need.title} />

        <div className="mt-6 space-y-6">
          <NeedDetailsCard
            need={need}
            canEdit={canEdit}
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
                  onClick={() => router.push(`/studies/${studyId}/needs/${needId}/evidence`)}
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

          <AiClassificationSection
            needId={need.id}
            needStatus={need.status}
            evidenceCount={evidenceCount}
            onReviewed={refreshNeed}
          />

          {canUseSurveyBuilder ? (
            <SurveyStatusCard
              needId={need.id}
              needStatus={need.status}
              domain={need.domain}
              subDomain={need.subDomain}
            />
          ) : null}
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}
