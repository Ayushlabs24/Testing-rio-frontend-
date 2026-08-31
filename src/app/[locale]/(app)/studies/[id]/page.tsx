"use client";

import {
  AlertTriangle,
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import type { AppLocale } from "@/i18n/routing";
import {
  formatDate as formatDateIntl,
  formatDateTime as formatDateTimeIntl,
} from "@/lib/format-date";
import {
  confidenceBandLabelKey,
  confidencePercent,
  confidenceTextClass,
  isFlaggedConfidence,
} from "@/lib/confidence-band";
import { cn } from "@/lib/utils";
import { DeleteNeedDialog } from "@/components/features/studies/delete-need-dialog";
import { DeleteStudyDialog } from "@/components/features/studies/delete-study-dialog";
import { ImportNeedsDialog } from "@/components/features/studies/import-needs-dialog";
import { ImportSurveyResultsDialog } from "@/components/features/studies/import-survey-results-dialog";
import { NeedStatusBadge } from "@/components/features/studies/study-status-badge";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { actAsOrgOptions } from "@/lib/act-as-org";
import { useStudyCenters, useStudyGovernorates } from "@/hooks/use-study-geography";
import { useRouter } from "@/i18n/navigation";
import { aiDecisionsService } from "@/services/ai-decisions/ai-decisions.service";
import { needsService } from "@/services/needs/needs.service";
import {
  NEED_EDITABLE_STATUSES,
  type Need,
  type NeedStatus,
} from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudyDetail } from "@/services/studies/studies.types";
import { surveysService } from "@/services/surveys/surveys.service";

const NEED_STATUSES: readonly NeedStatus[] = [
  "draft",
  "pending_ai_classification",
  "evidence_submitted",
  "ai_classified",
  "ai_classification_failed",
  "reviewer_approved",
  "survey_created",
  "survey_published",
];

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
function formatRelativeTime(iso: string, locale: AppLocale): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
    numeric: "auto",
  });
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

// Plain truncated text instead of a badge pill per item — a Need can carry
// many Governorates/Centers/Villages, and a row of colored badges per
// column made the table read as cluttered once there were more than a
// couple. Shows the first name, "+N" for the rest, and the full list in a
// title tooltip.
function CompactNameList({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-foreground truncate" title={names.join(", ")}>
      {names[0]}
      {names.length > 1 ? (
        <span className="text-muted-foreground"> +{names.length - 1}</span>
      ) : null}
    </span>
  );
}

// RIO-AI-001 — the confidence flag, in the one place a reviewer decides
// which Need to open next. Reads the band the backend already resolved from
// the configured thresholds; nothing here re-derives a threshold.
function NeedConfidenceCell({ need }: { need: Need }) {
  const t = useTranslations("app.studies.classification");
  const band = need.aiConfidenceBand;

  // No classification has run yet — there is nothing to be confident about.
  // Deliberately not rendered as 0% or as a flag.
  if (band === null) return <span className="text-muted-foreground">—</span>;

  const percent = confidencePercent(need.aiConfidence);
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("font-semibold tabular-nums", confidenceTextClass(band))}>
        {percent === null ? t("confidenceNotReported") : `${percent}%`}
      </span>
      {isFlaggedConfidence(band) ? (
        <AlertTriangle
          className={cn("size-3.5 shrink-0", confidenceTextClass(band))}
          aria-hidden="true"
        />
      ) : null}
      {/* The band name is the accessible form of the icon+colour above —
          a colour alone announces nothing to a screen reader. */}
      <span className="sr-only">{t(confidenceBandLabelKey(band))}</span>
    </span>
  );
}

type AiClassificationStatus = "not_started" | "classified" | "reviewed";
type SurveyStatus = "not_started" | "draft" | "submitted" | "rejected" | "published";

interface NeedRowData {
  need: Need;
  aiStatus: AiClassificationStatus;
  surveyStatus: SurveyStatus;
}

const AI_STATUS_VARIANT: Record<
  AiClassificationStatus,
  "outline" | "secondary" | "default"
> = {
  not_started: "outline",
  classified: "secondary",
  reviewed: "default",
};

const SURVEY_STATUS_VARIANT: Record<
  SurveyStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  not_started: "outline",
  draft: "secondary",
  submitted: "secondary",
  rejected: "destructive",
  published: "default",
};

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("app.studies.detail");
  const locale = useLocale() as AppLocale;
  const tStudies = useTranslations("app.studies");
  const tNeedDelete = useTranslations("app.studies.need.delete");
  const tStatus = useTranslations("app.studies.status");
  const router = useRouter();
  const canWrite = usePermission("studySurvey", "write");
  const canCaptureNeed = usePermission("dataCollection", "create");
  const canDeleteNeed = usePermission("dataCollection", "write");

  const [study, setStudy] = useState<StudyDetail | null>(null);
  const studyGovernorates = useStudyGovernorates(study);
  const studyCenters = useStudyCenters(study);
  const [needRows, setNeedRows] = useState<NeedRowData[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [surveyImportOpen, setSurveyImportOpen] = useState(false);
  const [needQuery, setNeedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<NeedStatus | "all">("all");
  // RIO-AI-001 — "low-confidence suggestions are flagged for closer reviewer
  // attention". A flag inside each Need only helps if the reviewer already
  // knows which Need to open, so the flag is surfaced here and this filter
  // narrows the list to exactly the ones that need a closer look.
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);

  const loadNeeds = () => {
    needsService
      .listByStudy(id)
      .then(async (needs) => {
        setNeedRows(
          needs.map((need) => ({
            need,
            aiStatus: "not_started",
            surveyStatus: "not_started",
          })),
        );
        const [aiStatuses, surveyStatuses] = await Promise.all([
          Promise.all(
            needs.map((need) => {
              // A Need whose automatic classification failed can be
              // manually classified instead (AiDecisionsService.
              // manualClassify) — that path updates the Need's own status
              // directly and never creates an AiDecision row, by design.
              // So "no AiDecision" only means "not started" while the Need
              // itself is still at one of these pre-classification
              // statuses; past that, the Need's status is the proof a
              // human already classified it, AiDecision row or not.
              const notYetClassified =
                need.status === "draft" ||
                need.status === "pending_ai_classification" ||
                need.status === "ai_classification_failed";
              return aiDecisionsService
                .listByNeed(need.id, actAsOrgOptions(need.orgId))
                .then((list): AiClassificationStatus => {
                  if (notYetClassified) return "not_started";
                  const latest = list[0];
                  if (!latest) return "reviewed";
                  return latest.humanDecision ? "reviewed" : "classified";
                })
                .catch((): AiClassificationStatus =>
                  notYetClassified ? "not_started" : "reviewed",
                );
            }),
          ),
          Promise.all(
            needs.map((need) =>
              surveysService
                .getSurveyByNeedId(need.id, actAsOrgOptions(need.orgId))
                .then((survey): SurveyStatus => {
                  if (!survey) return "not_started";
                  switch (survey.status) {
                    case "PUBLISHED":
                      return "published";
                    case "SUBMITTED":
                      return "submitted";
                    case "REJECTED":
                      return "rejected";
                    default:
                      return "draft";
                  }
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
          <div className="mb-6 flex justify-start">
            <BackButton href="/studies" label={t("backToList")} />
          </div>
          <PageHeader title={tStudies("noResults")} />
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

  // No role-based row filtering here anymore — AI classification and survey
  // building are entirely the Researcher's own pipeline; the Approver's
  // action point is the Survey Review page (reached via Reviewer SLA Alerts
  // or Survey Builder), not this list, so everyone who can read a Study
  // simply sees its full Need list.
  const filteredNeedRows = needRows
    ? needRows.filter(({ need }) => {
        const query = needQuery.trim().toLowerCase();
        const matchesQuery = !query || need.title.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || need.status === statusFilter;
        // A Need with no classification yet has no band at all, so it is not
        // "low confidence" — it has no confidence to judge. Excluded rather
        // than swept in, so the filter means what it says.
        const matchesConfidence =
          !lowConfidenceOnly || isFlaggedConfidence(need.aiConfidenceBand);
        return matchesQuery && matchesStatus && matchesConfidence;
      })
    : null;

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/studies" label={t("backToList")} />
        </div>
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
            ) : undefined
          }
        />

        <div className="mt-6 space-y-6">
          <Card className="shadow-md">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-foreground text-sm font-semibold">
                  {t("needsHeading")}
                </h2>
                {canCaptureNeed ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSurveyImportOpen(true)}
                    >
                      <Sparkles className="text-primary size-3.5" />
                      {t("importFromSurveyResults")}
                    </Button>
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

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    placeholder={t("searchNeedsPlaceholder")}
                    aria-label={t("searchNeedsPlaceholder")}
                    value={needQuery}
                    onChange={(event) => setNeedQuery(event.target.value)}
                    className="h-9 ps-9"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as NeedStatus | "all")}
                >
                  <SelectTrigger
                    className="h-9 w-full sm:w-56"
                    aria-label={t("filterStatusLabel")}
                  >
                    <SelectValue placeholder={t("filterStatusLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
                    {NEED_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {tStatus(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={lowConfidenceOnly ? "default" : "outline"}
                  className="h-9 w-full gap-2 sm:w-auto"
                  aria-pressed={lowConfidenceOnly}
                  onClick={() => setLowConfidenceOnly((prev) => !prev)}
                >
                  <AlertTriangle className="size-4" />
                  {t("filterLowConfidence")}
                </Button>
              </div>

              {filteredNeedRows === null ? (
                <div className="space-y-2">
                  <div className="bg-muted h-10 w-full rounded" />
                  <div className="bg-muted h-10 w-full rounded" />
                </div>
              ) : needRows && needRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("needsEmpty")}</p>
              ) : filteredNeedRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("needsNoSearchResults")}
                </p>
              ) : (
                <div className="border-border overflow-hidden rounded-lg border">
                  <TooltipProvider delayDuration={200}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("needTitleColumn")}</TableHead>
                          <TableHead>{t("governorateColumn")}</TableHead>
                          <TableHead>{t("centerColumn")}</TableHead>
                          <TableHead>{t("villageColumn")}</TableHead>
                          <TableHead>{t("statusColumn")}</TableHead>
                          <TableHead>{t("aiStatusColumn")}</TableHead>
                          <TableHead>{t("aiConfidenceColumn")}</TableHead>
                          <TableHead>{t("surveyStatusColumn")}</TableHead>
                          {canDeleteNeed ? <TableHead className="w-12" /> : null}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNeedRows.map(({ need, aiStatus, surveyStatus }) => (
                          <TableRow
                            key={need.id}
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() =>
                              router.push(`/studies/${study.id}/needs/${need.id}`)
                            }
                          >
                            <TableCell
                              dir="auto"
                              className="max-w-52 text-sm font-medium break-words whitespace-normal"
                            >
                              {need.title}
                            </TableCell>
                            <TableCell className="max-w-40 text-sm">
                              <CompactNameList
                                names={need.governorateIds.map(
                                  (id) =>
                                    studyGovernorates.find((g) => g.id === id)?.name ??
                                    id,
                                )}
                              />
                            </TableCell>
                            <TableCell className="max-w-40 text-sm">
                              <CompactNameList
                                names={need.centerIds.map(
                                  (id) =>
                                    studyCenters.find((c) => c.id === id)?.name ?? id,
                                )}
                              />
                            </TableCell>
                            <TableCell className="max-w-32 text-sm">
                              <CompactNameList names={need.village} />
                            </TableCell>
                            <TableCell>
                              <NeedStatusBadge status={need.status} />
                            </TableCell>
                            <TableCell>
                              <Badge variant={AI_STATUS_VARIANT[aiStatus]}>
                                {t(`aiStatus.${aiStatus}`)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <NeedConfidenceCell need={need} />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Link href={`/survey-builder/${need.id}`}>
                                <Badge
                                  variant={SURVEY_STATUS_VARIANT[surveyStatus]}
                                  className="cursor-pointer transition-opacity hover:opacity-80"
                                >
                                  {t(`surveyStatus.${surveyStatus}`)} ↗
                                </Badge>
                              </Link>
                            </TableCell>
                            {canDeleteNeed ? (
                              <TableCell onClick={(event) => event.stopPropagation()}>
                                {NEED_EDITABLE_STATUSES.includes(need.status) ? (
                                  <DeleteNeedDialog
                                    needId={need.id}
                                    onDeleted={() =>
                                      setNeedRows((prev) =>
                                        (prev ?? []).filter(
                                          (row) => row.need.id !== need.id,
                                        ),
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
                                    <TooltipContent>
                                      {tNeedDelete("lockedHint")}
                                    </TooltipContent>
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

          {/* Study Information — moved below the (now full-width) Needs
           * table, laid out horizontally rather than in a narrow sidebar
           * column. A Study has no status of its own now — that lives on
           * each Need. */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-foreground mb-4 text-sm font-semibold">
                {t("detailsHeading")}
              </h2>
              <dl className="flex flex-wrap items-start gap-x-10 gap-y-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <CalendarDays className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span title={formatDateTimeIntl(study.createdAt, locale)}>
                    {t("createdOn", { date: formatDateIntl(study.createdAt, locale) })}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span title={formatDateTimeIntl(study.updatedAt, locale)}>
                    {t("updatedRelative", {
                      time: formatRelativeTime(study.updatedAt, locale),
                    })}
                  </span>
                </div>
                {study.villages.length > 0 ? (
                  <div className="space-y-1.5">
                    <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <MapPin className="size-3.5" />
                      {t("villagesLabel")}
                    </dt>
                    <dd>
                      <VillageChips villages={study.villages} />
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>
        </div>

        <ImportNeedsDialog
          studyId={study.id}
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={loadNeeds}
        />

        <ImportSurveyResultsDialog
          studyId={study.id}
          open={surveyImportOpen}
          onOpenChange={setSurveyImportOpen}
          onImported={loadNeeds}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
