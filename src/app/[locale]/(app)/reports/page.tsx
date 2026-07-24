"use client";

import { BarChart3, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ReportActions } from "@/components/features/reports/report-actions";
import { ReportStatusBadge } from "@/components/features/reports/report-status-badge";
import { PermissionGuard } from "@/components/layout/permission-guard";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
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

const ALL = "all";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

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
  const [villageId, setVillageId] = useState<string>("");
  const [villages, setVillages] = useState<string[]>([]);
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresStudy =
    reportType !== null && REPORT_TYPE_META[reportType].requiresStudyId;
  const requiresVillage = reportType === "RPT14";

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setReportType(null);
      setStudyId("");
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
    !reportType || (requiresStudy && !studyId) || (requiresVillage && !villageId.trim());

  async function submit() {
    if (incomplete) return;
    setGenerating(true);
    setError(null);
    try {
      await reportsService.create({
        reportType: reportType!,
        studyId: requiresStudy ? studyId : undefined,
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
  const canCreate = usePermission("reportsDashboards", "create");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [studyFilter, setStudyFilter] = useState<string | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | typeof ALL>(ALL);
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

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
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyFilter, statusFilter]);

  return (
    <PermissionGuard module="reportsDashboards" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canCreate ? (
              <Button onClick={() => setGenerateOpen(true)} className="gap-2">
                <Plus className="size-4" />
                {t("newReport")}
              </Button>
            ) : null
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
              <Select value={studyFilter} onValueChange={setStudyFilter}>
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
                onValueChange={(v) => setStatusFilter(v as ReportStatus | typeof ALL)}
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
                  <SelectItem value="released">{t("status.released")}</SelectItem>
                  <SelectItem value="archived">{t("status.archived")}</SelectItem>
                  <SelectItem value="rejected">{t("status.rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("titleColumn")}</TableHead>
                  <TableHead className="w-24">{t("typeColumn")}</TableHead>
                  <TableHead className="w-28">{t("statusColumn")}</TableHead>
                  <TableHead className="w-44">{t("generatedColumn")}</TableHead>
                  <TableHead className="w-80" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 5 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
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
                  reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="py-4 text-sm font-medium">
                        {report.title}
                      </TableCell>
                      <TableCell className="text-sm">{report.reportType}</TableCell>
                      <TableCell>
                        <ReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(report.generatedAt)}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/reports/${report.id}`}>{t("view")}</Link>
                          </Button>
                          <ReportActions
                            report={report}
                            onChanged={load}
                            onError={(m) => setActionError(m || null)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
