"use client";

import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { DeleteNeedDialog } from "@/components/features/studies/delete-need-dialog";
import { DeleteStudyDialog } from "@/components/features/studies/delete-study-dialog";
import { ImportNeedsDialog } from "@/components/features/studies/import-needs-dialog";
import { NeedStatusBadge } from "@/components/features/studies/study-status-badge";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { Link, useRouter } from "@/i18n/navigation";
import { aiDecisionsService } from "@/services/ai-decisions/ai-decisions.service";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudyDetail } from "@/services/studies/studies.types";
import { surveysService } from "@/services/surveys/surveys.service";

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

type AiClassificationStatus = "not_started" | "classified" | "reviewed";
type SurveyStatus = "not_started" | "draft" | "published";

interface NeedRowData {
  need: Need;
  aiStatus: AiClassificationStatus;
  surveyStatus: SurveyStatus;
}

const AI_STATUS_VARIANT: Record<AiClassificationStatus, "outline" | "secondary" | "default"> = {
  not_started: "outline",
  classified: "secondary",
  reviewed: "default",
};

const SURVEY_STATUS_VARIANT: Record<SurveyStatus, "outline" | "secondary" | "default"> = {
  not_started: "outline",
  draft: "secondary",
  published: "default",
};

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("app.studies.detail");
  const tStudies = useTranslations("app.studies");
  const tNeedDelete = useTranslations("app.studies.need.delete");
  const router = useRouter();
  const canWrite = usePermission("studySurvey", "write");
  const canCaptureNeed = usePermission("dataCollection", "create");
  const canDeleteNeed = usePermission("dataCollection", "write");
  // Reviewer/Approver — read-only on dataCollection, approve on aiReview
  // (see role-matrix.ts) — their job starts once a Need reaches AI
  // Classification, so a Need still in draft/evidence collection isn't
  // theirs to look at yet. Everyone else (Research Officer, Admin) still
  // sees every Need, since they own the whole pipeline including this
  // earlier part of it.
  const canApproveAi = usePermission("aiReview", "approve");
  const isReviewerOnly = !canCaptureNeed && canApproveAi;

  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [needRows, setNeedRows] = useState<NeedRowData[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const loadNeeds = () => {
    needsService
      .listByStudy(id)
      .then(async (needs) => {
        setNeedRows(needs.map((need) => ({ need, aiStatus: "not_started", surveyStatus: "not_started" })));
        const [aiStatuses, surveyStatuses] = await Promise.all([
          Promise.all(
            needs.map((need) =>
              aiDecisionsService
                .listByNeed(need.id)
                .then((list): AiClassificationStatus => {
                  const latest = list[0];
                  if (!latest) return "not_started";
                  return latest.humanDecision ? "reviewed" : "classified";
                })
                .catch((): AiClassificationStatus => "not_started"),
            ),
          ),
          Promise.all(
            needs.map((need) =>
              surveysService
                .getSurveyByNeedId(need.id)
                .then((survey): SurveyStatus => {
                  if (!survey) return "not_started";
                  return survey.status === "PUBLISHED" ? "published" : "draft";
                })
                .catch((): SurveyStatus => "not_started"),
            ),
          ),
        ]);
        setNeedRows(
          needs.map((need, index) => ({
            need,
            aiStatus: aiStatuses[index],
            surveyStatus: surveyStatuses[index],
          })),
        );
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    studiesService
      .getById(id)
      .then(setStudy)
      .catch(() => setNotFound(true));
    loadNeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const visibleNeedRows = needRows
    ? isReviewerOnly
      ? needRows.filter(({ need }) => need.status !== "draft" && need.status !== "evidence_submitted")
      : needRows
    : null;

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
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-foreground text-sm font-semibold">
                    {t("needsHeading")}
                  </h2>
                  {canCaptureNeed ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setImportOpen(true)}
                      >
                        <Upload className="size-3.5" />
                        {t("importNeeds")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => router.push(`/studies/${study.id}/needs/new`)}
                      >
                        <Plus className="size-3.5" />
                        {t("addNeed")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {visibleNeedRows === null ? (
                  <div className="space-y-2">
                    <div className="bg-muted h-10 w-full rounded" />
                    <div className="bg-muted h-10 w-full rounded" />
                  </div>
                ) : visibleNeedRows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {isReviewerOnly ? t("needsEmptyForReviewer") : t("needsEmpty")}
                  </p>
                ) : (
                  <div className="border-border overflow-hidden rounded-lg border">
                    <TooltipProvider delayDuration={200}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("needTitleColumn")}</TableHead>
                          <TableHead>{t("villageColumn")}</TableHead>
                          <TableHead>{t("statusColumn")}</TableHead>
                          <TableHead>{t("aiStatusColumn")}</TableHead>
                          <TableHead>{t("surveyStatusColumn")}</TableHead>
                          {canDeleteNeed ? <TableHead className="w-12" /> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleNeedRows.map(({ need, aiStatus, surveyStatus }) => (
                          <TableRow
                            key={need.id}
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => router.push(`/studies/${study.id}/needs/${need.id}`)}
                          >
                            <TableCell className="max-w-52 truncate text-sm font-medium">
                              {need.title}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {need.village.slice(0, 2).map((v) => (
                                  <Badge key={v} variant="secondary" className="gap-1">
                                    <MapPin className="size-3" />
                                    {v}
                                  </Badge>
                                ))}
                                {need.village.length > 2 ? (
                                  <span className="text-muted-foreground text-xs">
                                    +{need.village.length - 2}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <NeedStatusBadge status={need.status} />
                            </TableCell>
                            <TableCell>
                              <Badge variant={AI_STATUS_VARIANT[aiStatus]}>
                                {t(`aiStatus.${aiStatus}`)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={SURVEY_STATUS_VARIANT[surveyStatus]}>
                                {t(`surveyStatus.${surveyStatus}`)}
                              </Badge>
                            </TableCell>
                            {canDeleteNeed ? (
                              <TableCell onClick={(event) => event.stopPropagation()}>
                                {need.status === "draft" ? (
                                  <DeleteNeedDialog
                                    needId={need.id}
                                    onDeleted={() =>
                                      setNeedRows((prev) =>
                                        (prev ?? []).filter((row) => row.need.id !== need.id),
                                      )
                                    }
                                    trigger={
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                                          aria-label={tNeedDelete("action")}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    }
                                  />
                                ) : (
                                  // Not `draft` anymore — evidence/an AI
                                  // classification/a survey may already
                                  // depend on this Need, so deletion is
                                  // blocked. Shown disabled with a reason
                                  // rather than just omitted, so it doesn't
                                  // silently look the same as "no
                                  // permission" (see the Evidence page's
                                  // identical pattern for a locked delete).
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          disabled
                                          className="text-muted-foreground size-8 shrink-0"
                                          aria-label={tNeedDelete("lockedHint")}
                                        >
                                          <Trash2 className="size-4" />
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>{tNeedDelete("lockedHint")}</TooltipContent>
                                  </Tooltip>
                                )}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </TooltipProvider>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Study Information — an at-a-glance panel (villages, timing)
           * instead of a bare label/value list. A Study has no status of
           * its own now — that lives on each Need. */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-foreground text-sm font-semibold">
                  {t("detailsHeading")}
                </h2>
                <dl className="space-y-4 text-sm">
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
                      <VillageChips villages={study.villages} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        <ImportNeedsDialog
          studyId={study.id}
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={loadNeeds}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
