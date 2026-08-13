"use client";

import { BarChart3, Eye, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FormattedDate } from "@/components/common/formatted-date";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { NcnpReportReviewActions } from "@/components/features/ncnp-report/ncnp-report-review-actions";
import { NcnpReportReviewBadge } from "@/components/features/ncnp-report/ncnp-report-review-badge";
import { reportId as consolidatedReportId } from "@/components/features/ncnp-report/ncnp-report-content-view";
import { ReportActions } from "@/components/features/reports/report-actions";
import { ReportStatusBadge } from "@/components/features/reports/report-status-badge";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Link, useRouter } from "@/i18n/navigation";
import { REPORTS_PAGE_SIZE, REPORTS_PAGE_SIZE_OPTIONS } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import {
  ncnpReportReviewService,
  type NcnpReportReviewSummary,
} from "@/services/ncnp-report-review/ncnp-report-review.service";
import { reportsService } from "@/services/reports/reports.service";
import {
  GENERATABLE_REPORT_TYPES,
  REPORT_TYPE_META,
  type Report,
  type ReportStatus,
  type ReportTypeCode,
} from "@/services/reports/reports.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";
import { surveysService, type SurveyListItem } from "@/services/surveys/surveys.service";

const ALL = "all";

// Distinguishes the org-scoped RPT01-14 reports from the cross-org NCNP
// Compiled Report — the two live in entirely different backend tables
// (Report is per-org with RLS; NcnpReportReview has none, by design — see
// this feature's original architecture notes), but the client wants them
// presented as one unified "Reports" surface, not two separate screens.
type ReportCategory = "ngo" | "consolidated";
type UnifiedRow =
  | { category: "ngo"; id: string; generatedAt: string; report: Report }
  | {
      category: "consolidated";
      id: string;
      generatedAt: string;
      review: NcnpReportReviewSummary;
    };

const REPORT_TYPE_ITEMS = GENERATABLE_REPORT_TYPES.map((code) => ({
  value: code,
  label: `${code} — ${REPORT_TYPE_META[code].name}`,
}));

/** Report type (searchable) + study + (for RPT14) village, in a modal. */
function GenerateReportDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}) {
  const t = useTranslations("app.reports.create");
  const [reportType, setReportType] = useState<ReportTypeCode | null>(null);
  const [studyId, setStudyId] = useState<string>("");
  const [surveyId, setSurveyId] = useState<string>("");
  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null);
  const [villageId, setVillageId] = useState<string>("");
  const [villages, setVillages] = useState<string[]>([]);
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresStudy =
    reportType !== null && REPORT_TYPE_META[reportType].requiresStudyId;
  const requiresSurvey =
    reportType !== null && REPORT_TYPE_META[reportType].requiresSurveyId;
  const requiresVillage = reportType === "RPT14";

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setReportType(null);
      setStudyId("");
      setSurveyId("");
      setSurveys(null);
      setVillageId("");
      setVillages([]);
      setError(null);
    }
  }

  useEffect(() => {
    if (requiresStudy)
      studiesService
        .list()
        .then(setStudies)
        .catch(() => setStudies([]));
  }, [requiresStudy]);

  // Survey list for the survey-scoped types. Filtered to surveys that actually
  // have responses — generating from an unscored survey fails server-side with
  // STUDY_NOT_SCORED, so offering those would only produce a dead end.
  useEffect(() => {
    if (!requiresSurvey || !studyId) return;
    let cancelled = false;
    // No synchronous reset here — the list is already cleared on dialog close
    // and in the study <Select>'s own onValueChange, and doing it in the effect
    // body triggers cascading renders (same reasoning as the village effect).
    surveysService
      .listByStudy(studyId)
      .then((rows) => {
        if (cancelled) return;
        setSurveys(rows.filter((s) => s.responseCount > 0));
      })
      .catch(() => {
        if (!cancelled) setSurveys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [requiresSurvey, studyId]);

  // Village dropdown is populated from the selected study's needs (each Need
  // carries its own village list), falling back to the study's own village set.
  // (The list is cleared on dialog close and when the study changes, so no
  // synchronous reset is needed here — that would trigger cascading renders.)
  useEffect(() => {
    if (!requiresVillage || !studyId) return;
    let cancelled = false;
    const fallback = () => studies.find((s) => s.id === studyId)?.villages ?? [];
    needsService
      .listByStudy(studyId)
      .then((needs) => {
        if (cancelled) return;
        const fromNeeds = Array.from(
          new Set(needs.flatMap((n) => n.village ?? [])),
        ).sort();
        setVillages(fromNeeds.length ? fromNeeds : fallback());
      })
      .catch(() => {
        if (!cancelled) setVillages(fallback());
      });
    return () => {
      cancelled = true;
    };
  }, [requiresVillage, studyId, studies]);

  const incomplete =
    !reportType ||
    (requiresStudy && !studyId) ||
    (requiresSurvey && !surveyId) ||
    (requiresVillage && !villageId.trim());

  async function submit() {
    if (incomplete) return;
    setGenerating(true);
    setError(null);
    try {
      await reportsService.create({
        reportType: reportType!,
        studyId: requiresStudy ? studyId : undefined,
        surveyId: requiresSurvey ? surveyId : undefined,
        filters: requiresVillage ? { villageId: villageId.trim() } : undefined,
      });
      handleOpenChange(false);
      onGenerated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("reportTypeLabel")}</Label>
            <Combobox
              items={REPORT_TYPE_ITEMS}
              value={reportType}
              onSelect={(value) => setReportType(value as ReportTypeCode)}
              placeholder={t("reportTypeLabel")}
              searchPlaceholder={t("reportTypeSearchPlaceholder")}
              emptyText={t("reportTypeEmpty")}
              aria-label={t("reportTypeLabel")}
            />
          </div>
          {requiresStudy ? (
            <div className="space-y-2">
              <Label>{t("studyLabel")}</Label>
              <Select
                value={studyId}
                onValueChange={(v) => {
                  setStudyId(v);
                  setSurveyId("");
                  setSurveys(null);
                  setVillageId("");
                  setVillages([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("studyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {studies.map((study) => (
                    <SelectItem key={study.id} value={study.id}>
                      {study.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {requiresSurvey ? (
            <div className="space-y-2">
              <Label>{t("surveyLabel")}</Label>
              <Select
                value={surveyId}
                onValueChange={setSurveyId}
                disabled={!studyId || !surveys || surveys.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("surveyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(surveys ?? []).map((survey) => (
                    <SelectItem key={survey.id} value={survey.id}>
                      {survey.title} — {survey.responseCount} {t("surveyResponsesSuffix")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {studyId && surveys?.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("surveyEmpty")}</p>
              ) : null}
            </div>
          ) : null}
          {requiresVillage ? (
            <div className="space-y-2">
              <Label>{t("villageLabel")}</Label>
              <Select
                value={villageId}
                onValueChange={setVillageId}
                disabled={!studyId || villages.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("villagePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {villages.map((village) => (
                    <SelectItem key={village} value={village}>
                      {village}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {studyId && villages.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("villageEmpty")}</p>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={generating || incomplete}>
            {generating ? t("generating") : t("generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPage() {
  const t = useTranslations("app.reports");
  const tr = useTranslations("systemAdmin.ncnpReport.review");
  const router = useRouter();
  const canCreate = usePermission("reportsDashboards", "create");
  const canGenerateConsolidated = usePermission("ncnpReport", "write");
  // Only System Admin and System Reviewer hold any `ncnpReport` grant today
  // (Center Supervisor and NCNP User both hold none — see role-matrix.ts) —
  // the Consolidated category filter/column is real signal only for those
  // two roles; every other role would only ever see "NGO Report" rows, so
  // showing it is pure clutter for them.
  const canSeeConsolidated = usePermission("ncnpReport", "read");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatingConsolidated, setGeneratingConsolidated] = useState(false);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [consolidatedReviews, setConsolidatedReviews] = useState<
    NcnpReportReviewSummary[] | null
  >(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [studyFilter, setStudyFilter] = useState<string | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | typeof ALL>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | typeof ALL>(ALL);
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(REPORTS_PAGE_SIZE);

  useEffect(() => {
    studiesService
      .list()
      .then(setStudies)
      .catch(() => undefined);
  }, []);

  function load() {
    reportsService
      .list({
        studyId: studyFilter === ALL ? undefined : studyFilter,
        status: statusFilter === ALL ? undefined : statusFilter,
      })
      .then((rows) => {
        setReports(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setReports([]);
        setLoadFailed(true);
      });
    // Fetched unconditionally rather than gated on `canReadConsolidated` —
    // that permission check depends on the auth session having loaded,
    // which can still be in flight on first mount; a 403 here (a role with
    // no `ncnpReport:read`, e.g. a plain NGO role) is expected and just
    // means an empty consolidated-reports list, not a real failure.
    ncnpReportReviewService
      .list()
      .then(setConsolidatedReviews)
      .catch(() => setConsolidatedReviews([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyFilter, statusFilter]);

  async function handleGenerateConsolidated() {
    setActionError("");
    setGeneratingConsolidated(true);
    try {
      const created = await ncnpReportReviewService.generate();
      router.push(`/reports/${created.id}?type=consolidated`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : tr("actionError"));
      setGeneratingConsolidated(false);
    }
  }

  const loading = reports === null || consolidatedReviews === null;
  const unified: UnifiedRow[] = [
    ...(reports ?? []).map((report): UnifiedRow => ({
      category: "ngo",
      id: report.id,
      generatedAt: report.generatedAt,
      report,
    })),
    ...(consolidatedReviews ?? []).map((review): UnifiedRow => ({
      category: "consolidated",
      id: review.id,
      generatedAt: review.generatedAt,
      review,
    })),
  ]
    .filter((row) => categoryFilter === ALL || row.category === categoryFilter)
    // Best-effort: the Status filter's values (draft/released/archived/
    // rejected) are Report's own enum — "approved" (a consolidated-only
    // status) has no filter option, so it's excluded whenever a status
    // filter is active. Matches literally where the two enums overlap.
    .filter(
      (row) =>
        statusFilter === ALL ||
        (row.category === "ngo"
          ? row.report.status === statusFilter
          : row.review.status === statusFilter),
    )
    .sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
    );

  const pageCount = Math.max(1, Math.ceil(unified.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = unified.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  // Title, [Category], Type, Status, Generated, Actions — Category only
  // exists for roles that can actually see Consolidated rows.
  const columnCount = canSeeConsolidated ? 6 : 5;

  return (
    <PermissionGuard module="reportsDashboards" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <div className="flex items-center gap-2">
              {canGenerateConsolidated ? (
                <Button
                  className="gap-2"
                  disabled={generatingConsolidated}
                  onClick={handleGenerateConsolidated}
                >
                  <Plus className="size-4" />
                  {generatingConsolidated
                    ? tr("generating")
                    : t("generateConsolidatedButton")}
                </Button>
              ) : null}
              {canCreate ? (
                <Button onClick={() => setGenerateOpen(true)} className="gap-2">
                  <Plus className="size-4" />
                  {t("newReport")}
                </Button>
              ) : null}
            </div>
          }
        />

        {actionError ? (
          <p className="text-destructive mb-4 text-sm">{actionError}</p>
        ) : null}

        <h2 className="text-foreground mb-3 text-sm font-semibold">
          {t("generatedHeading")}
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
              {canSeeConsolidated ? (
                <Select
                  value={categoryFilter}
                  onValueChange={(v) => {
                    setCategoryFilter(v as ReportCategory | typeof ALL);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-48"
                    aria-label={t("filterCategoryLabel")}
                  >
                    <SelectValue placeholder={t("filterCategoryAll")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterCategoryAll")}</SelectItem>
                    <SelectItem value="ngo">{t("filterCategoryNgo")}</SelectItem>
                    <SelectItem value="consolidated">
                      {t("filterCategoryConsolidated")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <Select
                value={studyFilter}
                onValueChange={(v) => {
                  setStudyFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-56"
                  aria-label={t("filterStudyLabel")}
                >
                  <SelectValue placeholder={t("filterStudyAll")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterStudyAll")}</SelectItem>
                  {studies.map((study) => (
                    <SelectItem key={study.id} value={study.id}>
                      {study.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as ReportStatus | typeof ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-40"
                  aria-label={t("filterStatusLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterStatusAll")}</SelectItem>
                  <SelectItem value="draft">{t("status.draft")}</SelectItem>
                  <SelectItem value="submitted">{t("status.submitted")}</SelectItem>
                  <SelectItem value="released">{t("status.released")}</SelectItem>
                  <SelectItem value="archived">{t("status.archived")}</SelectItem>
                  <SelectItem value="rejected">{t("status.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  {canSeeConsolidated ? (
                    <TableHead className="w-36">{t("categoryColumn")}</TableHead>
                  ) : null}
                  <TableHead className="w-24">{t("typeColumn")}</TableHead>
                  <TableHead className="w-56">{t("statusColumn")}</TableHead>
                  <TableHead className="w-44">{t("generatedColumn")}</TableHead>
                  <TableHead className="w-56" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: columnCount }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : unified.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <BarChart3 className="size-5" />
                        </div>
                        <p>{loadFailed ? t("loadError") : t("noReports")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell
                        dir="auto"
                        className="max-w-sm py-4 text-sm font-medium break-words whitespace-normal"
                      >
                        {row.category === "ngo"
                          ? row.report.title
                          : consolidatedReportId(row.review.generatedAt)}
                      </TableCell>
                      {canSeeConsolidated ? (
                        <TableCell className="text-sm">
                          <Badge
                            variant={
                              row.category === "consolidated" ? "default" : "outline"
                            }
                          >
                            {row.category === "ngo"
                              ? t("filterCategoryNgo")
                              : t("filterCategoryConsolidated")}
                          </Badge>
                        </TableCell>
                      ) : null}
                      <TableCell className="text-sm">
                        {row.category === "ngo" ? row.report.reportType : null}
                      </TableCell>
                      <TableCell>
                        {row.category === "ngo" ? (
                          <ReportStatusBadge status={row.report.status} />
                        ) : (
                          <NcnpReportReviewBadge
                            status={row.review.status}
                            label={tr(`status.${row.review.status}`)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <FormattedDate value={row.generatedAt} withTime />
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-nowrap items-center justify-end gap-1.5">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  asChild
                                  size="icon-sm"
                                  variant="outline"
                                  aria-label={t("tooltip.view")}
                                >
                                  <Link
                                    href={
                                      row.category === "ngo"
                                        ? `/reports/${row.id}`
                                        : `/reports/${row.id}?type=consolidated`
                                    }
                                  >
                                    <Eye />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("tooltip.view")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {row.category === "ngo" ? (
                            <ReportActions
                              report={row.report}
                              onChanged={load}
                              onError={(m) => setActionError(m || null)}
                            />
                          ) : (
                            <NcnpReportReviewActions
                              review={row.review}
                              onChanged={load}
                              onError={(m) => setActionError(m || null)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {unified.length > 0 ? (
              <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-40"
                    aria-label={t("pagination.rowsPerPage")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORTS_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {t("pagination.rowsPerPage")}: {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                  className="sm:w-auto"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {canCreate ? (
          <GenerateReportDialog
            open={generateOpen}
            onOpenChange={setGenerateOpen}
            onGenerated={load}
          />
        ) : null}
      </PageContainer>
    </PermissionGuard>
  );
}
