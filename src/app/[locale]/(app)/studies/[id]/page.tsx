"use client";

import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState, type ReactNode } from "react";
import { AiClassificationSection } from "@/components/features/studies/ai-classification-section";
import { DeleteStudyDialog } from "@/components/features/studies/delete-study-dialog";
import { NeedSection } from "@/components/features/studies/need-section";
import { StudyStatusBadge } from "@/components/features/studies/study-status-badge";
import { SurveyStatusCard } from "@/components/features/studies/survey-status-card";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@/i18n/navigation";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudyDetail } from "@/services/studies/studies.types";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

const RELATIVE_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.35, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

/** "2 hours ago" instead of a raw timestamp — reads faster at a glance. */
function formatRelativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return rtf.format(Math.round(duration), "years");
}

/** Villages as chips, not plain text — a Need's `village` is a real array
 * from the backend now, not a single comma-separated string to split here. */
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

type StepState = "not_started" | "in_progress" | "completed";

const STEP_BADGE_CLASS: Record<StepState, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-badge-warning text-badge-warning-foreground",
  completed: "bg-badge-success text-badge-success-foreground",
};

/** Shared chrome for a workflow step — colored icon + tinted header strip +
 * status badge, instead of yet another plain white card. */
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

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("app.studies.detail");
  const tStudies = useTranslations("app.studies");
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillVillage = searchParams.get("village") ?? "";
  const canWrite = usePermission("studySurvey", "write");
  const canCaptureNeed = usePermission("dataCollection", "create");
  const canViewEvidence = usePermission("dataCollection", "read");
  const canUseSurveyBuilder = usePermission("surveyBuilder", "read");

  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [need, setNeed] = useState<Need | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    studiesService
      .getById(id)
      .then(setStudy)
      .catch(() => setNotFound(true));
    needsService
      .getByStudy(id)
      .then(setNeed)
      .catch(() => undefined);
  }, [id]);

  if (notFound) {
    return (
      <PermissionGuard module="studySurvey" action="read">
        <PageContainer>
          <PageHeader title={tStudies("noResults")} />
          <Button
            variant="outline"
            onClick={() => router.push("/studies")}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Button>
        </PageContainer>
      </PermissionGuard>
    );
  }

  if (study === null) {
    return (
      <PermissionGuard module="studySurvey" action="read">
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
    study.evidenceCount === 0
      ? "not_started"
      : study.status === "draft" || study.status === "need_captured"
        ? "in_progress"
        : "completed";

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <Link
          href="/studies"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Link>

        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          {t("eyebrow")}
        </p>
        <PageHeader
          title={study.title}
          actions={
            canWrite ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/studies/${study.id}/edit`)}
                  className="gap-2"
                >
                  <Pencil className="size-4" />
                  {t("edit")}
                </Button>
                <DeleteStudyDialog
                  studyId={study.id}
                  onDeleted={() => router.push("/studies")}
                  trigger={
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive gap-2">
                        <Trash2 className="size-4" />
                        {tStudies("delete.action")}
                      </Button>
                    </AlertDialogTrigger>
                  }
                />
              </>
            ) : null
          }
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="shadow-md">
              <CardContent className="p-6">
                <NeedSection
                  studyId={study.id}
                  studyStatus={study.status}
                  studyVillages={study.villages}
                  need={need}
                  canEdit={canCaptureNeed}
                  prefillVillage={prefillVillage}
                  onSaved={(saved) => {
                    setNeed(saved);
                    studiesService
                      .getById(id)
                      .then(setStudy)
                      .catch(() => undefined);
                  }}
                />
              </CardContent>
            </Card>

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
                    onClick={() => router.push(`/studies/${study.id}/evidence`)}
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
                      study.evidenceCount > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {study.evidenceCount}
                  </span>
                  <p className="text-foreground text-sm font-medium">
                    {t("evidenceCount", { count: study.evidenceCount })}
                  </p>
                </div>
              </WorkflowStep>
            ) : null}
          </div>

          {/* Study Information — an at-a-glance panel (status, timing,
           * village, evidence, assigned reviewer) instead of a bare
           * label/value list. */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-foreground text-sm font-semibold">
                  {t("detailsHeading")}
                </h2>
                <dl className="space-y-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">{t("statusLabel")}</dt>
                    <dd>
                      <StudyStatusBadge status={study.status} />
                    </dd>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span title={formatDateTime(study.createdAt)}>
                      {t("createdOn", { date: formatDate(study.createdAt) })}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span title={formatDateTime(study.updatedAt)}>
                      {t("updatedRelative", {
                        time: formatRelativeTime(study.updatedAt),
                      })}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <MapPin className="size-3.5" />
                      {t("villagesLabel")}
                    </dt>
                    <dd>
                      <VillageChips villages={need?.village ?? []} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Classification (Need-based) and Survey Builder's AI
         * recommendation (Study-level) run full width, one below the other,
         * as their own sections — two distinct AI features, not one card. */}
        <div className="mt-6 space-y-6">
          <AiClassificationSection
            studyId={study.id}
            studyStatus={study.status}
            hasNeed={need !== null}
            evidenceCount={study.evidenceCount}
            onReviewed={() =>
              studiesService
                .getById(id)
                .then(setStudy)
                .catch(() => undefined)
            }
          />

          {canUseSurveyBuilder ? (
            <SurveyStatusCard
              studyId={study.id}
              domain={study.domain}
              subDomain={study.subDomain}
            />
          ) : null}
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}
