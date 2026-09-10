"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Gauge,
  FileText,
  Edit3,
} from "lucide-react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { BackButton } from "@/components/common/back-button";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useRouter } from "@/i18n/navigation";
import { usePermission } from "@/hooks/use-permission";
import {
  combinedReportService,
  CombinedReportContext,
  CombinedReportSummary,
} from "@/services/reports/combined-report.service";
import { reportsService } from "@/services/reports/reports.service";

export default function CombinedReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studyId } = use(params);
  const t = useTranslations("CombinedReport");
  const router = useRouter();

  // Combined-summary status arrives as a backend enum string; render its
  // localized label, falling back to the raw value if a new status is added
  // server-side before its key exists here.
  const summaryStatusLabel = (status: string | null | undefined) => {
    const key = status ?? "NOT_GENERATED";
    return t.has(`summaryStatusValues.${key}`) ? t(`summaryStatusValues.${key}`) : key;
  };

  const canAi = usePermission("aiReview", "write");

  const [context, setContext] = useState<CombinedReportContext | null>(null);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  const [selectedDocSummaryIds, setSelectedDocSummaryIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [activeSummary, setActiveSummary] = useState<CombinedReportSummary | null>(null);
  const [editedJson, setEditedJson] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ctx = await combinedReportService.getContext(studyId);
      setContext(ctx);
      setSelectedDocSummaryIds(
        ctx.confirmedDocumentSummaries.map((d) => d.confirmedSummary.id),
      );
      if (ctx.latestCombinedSummary) {
        setActiveSummary(ctx.latestCombinedSummary);
        setEditedJson(
          ctx.latestCombinedSummary.officerEditedOutputJson ||
            ctx.latestCombinedSummary.aiOutputJson,
        );
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("errors.loadContext");
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [studyId, t]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleDocToggle = (summaryId: string) => {
    setSelectedDocSummaryIds((prev) =>
      prev.includes(summaryId)
        ? prev.filter((id) => id !== summaryId)
        : [...prev, summaryId],
    );
  };

  const handleGenerateCombinedSummary = async () => {
    if (!context?.confirmedScoreSummary) {
      alert(t("scoreSummarySection.unconfirmedWarning"));
      return;
    }
    if (selectedDocSummaryIds.length === 0) {
      alert(t("errors.selectOneDocSummary"));
      return;
    }

    setGenerating(true);
    try {
      const summary = await combinedReportService.generateCombinedSummary(
        studyId,
        selectedDocSummaryIds,
      );
      setActiveSummary(summary);
      setEditedJson(summary.officerEditedOutputJson || summary.aiOutputJson);
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("errors.generateSummary");
      alert(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmCombinedSummary = async () => {
    if (!activeSummary) return;
    setConfirming(true);
    try {
      if (editing && editedJson) {
        await combinedReportService.updateCombinedSummary(
          studyId,
          activeSummary.id,
          editedJson,
        );
      }
      const confirmed = await combinedReportService.confirmCombinedSummary(
        studyId,
        activeSummary.id,
      );
      setActiveSummary(confirmed);
      setEditing(false);
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("errors.confirmSummary");
      alert(errorMsg);
    } finally {
      setConfirming(false);
    }
  };

  const handleGenerateReportPreview = async () => {
    if (!activeSummary || activeSummary.status !== "OFFICER_CONFIRMED") {
      alert(t("errors.confirmBeforePreview"));
      return;
    }
    setGeneratingReport(true);
    try {
      const report = await reportsService.create({
        reportType: "RPT16",
        studyId,
      });
      router.push(`/reports/${report.id}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("errors.generatePreview");
      alert(errorMsg);
    } finally {
      setGeneratingReport(false);
    }
  };

  const scoreSummaryConfirmed =
    context?.confirmedScoreSummary?.status === "OFFICER_CONFIRMED";
  const canGenerate = scoreSummaryConfirmed && selectedDocSummaryIds.length > 0;

  return (
    <PermissionGuard module="reportsDashboards" action="read">
      <PageContainer>
        <div className="mb-6 flex items-center justify-between">
          <BackButton
            href={`/studies/${studyId}/evidence-documents`}
            label={t("backToEvidenceDocuments")}
          />
          {activeSummary?.status === "OFFICER_CONFIRMED" && (
            <Button
              onClick={handleGenerateReportPreview}
              disabled={generatingReport}
              className="flex items-center gap-2"
            >
              <FileCheck className="size-4" />
              {t("generateReportPreview")}
            </Button>
          )}
        </div>

        <PageHeader title={t("title")} description={t("subtitle")} />

        {/* Study Context Card */}
        <Card className="border-border bg-card/60 mb-6">
          <CardContent className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("studyName")}
              </p>
              <p className="text-foreground text-base font-semibold">
                {context?.study.title ? (
                  <AutoTranslate text={context.study.title} />
                ) : (
                  "..."
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("contextEntityOrg")}
              </p>
              <p className="text-foreground text-base font-semibold">
                {context?.study.orgName ? (
                  <AutoTranslate text={context.study.orgName} />
                ) : (
                  "..."
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("contextRegionGovernorate")}
              </p>
              <p className="text-foreground text-base font-semibold">
                <AutoTranslate text={context?.study.region ?? ""} />
                {" — "}
                <AutoTranslate text={context?.study.governorate ?? ""} />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("combinedStatus")}
              </p>
              <Badge
                variant={
                  activeSummary?.status === "OFFICER_CONFIRMED"
                    ? "default"
                    : activeSummary?.status === "STALE"
                      ? "destructive"
                      : "secondary"
                }
                className="mt-1"
              >
                {summaryStatusLabel(activeSummary?.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {activeSummary?.status === "STALE" && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive mb-6 flex items-center gap-3 rounded-lg border p-4 text-xs font-medium">
            <AlertTriangle className="size-5 shrink-0" />
            <span>{t("staleWarning")}</span>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* SECTION A: Score-Based Summary Card */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="text-primary size-5" />
                {t("scoreSummaryStatusTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scoreSummaryConfirmed ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t("confirmationStatus")}
                    </span>
                    <Badge variant="default">
                      {t("summaryStatusValues.OFFICER_CONFIRMED")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t("confirmedTimestamp")}
                    </span>
                    <span className="text-xs font-semibold">
                      {context?.confirmedScoreSummary?.officerConfirmedAt ? (
                        <FormattedDate
                          value={context.confirmedScoreSummary.officerConfirmedAt}
                        />
                      ) : (
                        t("confirmedFallback")
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs font-medium">
                      {t("methodologyVersion")}
                    </span>
                    <span className="text-xs font-semibold">
                      <AutoTranslate text={context?.study.methodologyVersion} />
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border p-4 text-xs">
                  <AlertTriangle className="mr-2 inline size-4" />
                  {t("scoreSummarySection.unconfirmedWarning")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION B: Confirmed Document Summaries Selection Table */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="text-primary size-5" />
                {t("docSummariesSelectionTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {context?.confirmedDocumentSummaries.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {t("noConfirmedDocSummaries")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{t("table.select")}</TableHead>
                      <TableHead>{t("table.documentTitle")}</TableHead>
                      <TableHead>{t("table.refId")}</TableHead>
                      <TableHead>{t("table.type")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {context?.confirmedDocumentSummaries.map((doc) => (
                      <TableRow key={doc.confirmedSummary.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDocSummaryIds.includes(
                              doc.confirmedSummary.id,
                            )}
                            onCheckedChange={() =>
                              handleDocToggle(doc.confirmedSummary.id)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          <AutoTranslate text={doc.documentTitle} />
                        </TableCell>
                        <TableCell className="text-xs">{doc.sourceReferenceId}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">
                            {t.has(`documentTypeValues.${doc.documentType}`)
                              ? t(`documentTypeValues.${doc.documentType}`)
                              : doc.documentType}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Generate Combined Summary Action Button */}
        <div className="mb-8 flex justify-center">
          <Button
            size="lg"
            onClick={handleGenerateCombinedSummary}
            disabled={!canGenerate || generating}
            className="flex items-center gap-2 px-8"
          >
            <Sparkles className="size-5" />
            {generating ? t("generating") : t("generateButton")}
          </Button>
        </div>

        {/* Combined Summary Preview & Editing Card */}
        {activeSummary && editedJson && (
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="text-primary size-5" />
                {t("aiCombinedSummaryTitle")}
              </CardTitle>
              <div className="flex gap-2">
                {canAi && activeSummary.status !== "OFFICER_CONFIRMED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(!editing)}
                  >
                    <Edit3 className="mr-1 size-4" />
                    {editing ? t("preview") : t("editDraft")}
                  </Button>
                )}
                {canAi && activeSummary.status !== "OFFICER_CONFIRMED" && (
                  <Button
                    size="sm"
                    onClick={handleConfirmCombinedSummary}
                    disabled={confirming}
                  >
                    <CheckCircle2 className="mr-1 size-4" />
                    {confirming ? t("confirming") : t("confirmButton")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Label>{t("metrics.executiveSummary")}</Label>
                    <Textarea
                      rows={5}
                      value={String(editedJson?.executiveSummary || "")}
                      onChange={(e) =>
                        setEditedJson({ ...editedJson, executiveSummary: e.target.value })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-xs">
                  {/* Executive Summary */}
                  <div>
                    <h3 className="text-foreground mb-1 text-sm font-semibold">
                      {t("sectionHeadings.executiveSummary")}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <AutoTranslate text={String(editedJson?.executiveSummary || "")} />
                    </p>
                  </div>

                  {/* Quantitative Score Findings */}
                  {(() => {
                    const sb = editedJson?.scoreBasedFindings as
                      Record<string, unknown> | undefined;
                    return (
                      <div>
                        <h3 className="text-foreground mb-2 text-sm font-semibold">
                          {t("sectionHeadings.scoreBasedFindings")}
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-muted/40 rounded-md p-3">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              {t("metrics.severityScore")}
                            </span>
                            <p className="text-foreground text-lg font-bold">
                              {String(sb?.overallSeverityScore ?? "")}
                            </p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              {t("metrics.priorityScore")}
                            </span>
                            <p className="text-foreground text-lg font-bold">
                              {String(sb?.priorityScore ?? "")}
                            </p>
                          </div>
                          <div className="bg-muted/40 rounded-md p-3">
                            <span className="text-muted-foreground text-[10px] font-bold uppercase">
                              {t("metrics.priorityStatus")}
                            </span>
                            <Badge className="mt-1">
                              {String(sb?.priorityStatus ?? "")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Document-Based Evidence */}
                  <div>
                    <h3 className="text-foreground mb-2 text-sm font-semibold">
                      {t("sectionHeadings.documentBasedEvidence")}
                    </h3>
                    <div className="space-y-2">
                      {(
                        (editedJson?.documentBasedEvidence as Record<
                          string,
                          unknown
                        >[]) || []
                      ).map((ev: Record<string, unknown>, i: number) => (
                        <div key={i} className="bg-card rounded-md border p-3">
                          <p className="text-foreground font-semibold">
                            <AutoTranslate text={String(ev.documentTitle || "")} />{" "}
                            {t("refPrefix", {
                              ref: String(ev.sourceReferenceId || ""),
                            })}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            <AutoTranslate text={String(ev.keyEvidenceFinding || "")} />
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h3 className="text-foreground mb-2 text-sm font-semibold">
                      {t("sectionHeadings.recommendations")}
                    </h3>
                    <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                      {(
                        (editedJson?.recommendations as (
                          Record<string, unknown> | string
                        )[]) || []
                      ).map((r: Record<string, unknown> | string, i: number) => (
                        <li key={i}>
                          {typeof r === "string" ? (
                            <AutoTranslate text={r} />
                          ) : (
                            <>
                              <AutoTranslate text={String(r.intervention || "")} />{" "}
                              {t("priorityParenthetical", {
                                priority: String(r.priority || ""),
                              })}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </PermissionGuard>
  );
}
