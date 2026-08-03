"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  FileCheck,
  Gauge,
  FileText,
  Edit3,
  Save,
  ArrowRight,
  BarChart2,
  Layers,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import type { Report } from "@/services/reports/reports.types";

interface CombinedSummaryTabProps {
  studyId: string;
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

export function CombinedSummaryTab({ studyId }: CombinedSummaryTabProps) {
  const router = useRouter();
  const canAi = usePermission("aiReview", "write");

  const [context, setContext] = useState<CombinedReportContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDocSummaryIds, setSelectedDocSummaryIds] = useState<string[]>([]);
  // Which score summary to combine. Single-select: the schema stores exactly one
  // score summary reference per combined report.
  const [selectedScoreSummaryId, setSelectedScoreSummaryId] = useState<string | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [activeSummary, setActiveSummary] = useState<CombinedReportSummary | null>(null);
  const [editedJson, setEditedJson] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Log of RPT16 report records already generated for this study, shown below
  // the generation controls so each run leaves a visible trail.
  const [reportLog, setReportLog] = useState<Report[]>([]);
  const [reportLogError, setReportLogError] = useState<string | null>(null);

  const loadReportLog = useCallback(async () => {
    setReportLogError(null);
    try {
      const rows = await reportsService.list({ reportType: "RPT16", studyId });
      setReportLog(rows);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load generated combined reports.";
      setReportLogError(errorMsg);
    }
  }, [studyId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ctx = await combinedReportService.getContext(studyId);
      setContext(ctx);

      // Default select all available document summaries
      setSelectedDocSummaryIds(
        ctx.confirmedDocumentSummaries.map((d) => d.confirmedSummary.id),
      );

      // Preselect the most recent score summary, keeping the officer's choice if
      // it is still present after a reload.
      const options = ctx.availableScoreSummaries ?? [];
      setSelectedScoreSummaryId((current) =>
        current && options.some((o) => o.id === current)
          ? current
          : (options[0]?.id ?? null),
      );

      if (ctx.latestCombinedSummary) {
        setActiveSummary(ctx.latestCombinedSummary);
        setEditedJson(
          ctx.latestCombinedSummary.officerEditedOutputJson ||
            ctx.latestCombinedSummary.aiOutputJson,
        );
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load combined report context.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadData();
        void loadReportLog();
      }
    });
    return () => {
      active = false;
    };
  }, [loadData, loadReportLog]);

  const handleDocToggle = (summaryId: string) => {
    setSelectedDocSummaryIds((prev) =>
      prev.includes(summaryId)
        ? prev.filter((id) => id !== summaryId)
        : [...prev, summaryId],
    );
  };

  const handleSelectAllDocs = (checked: boolean) => {
    if (checked && context) {
      setSelectedDocSummaryIds(
        context.confirmedDocumentSummaries.map((d) => d.confirmedSummary.id),
      );
    } else {
      setSelectedDocSummaryIds([]);
    }
  };

  const handleGenerateCombinedSummary = async () => {
    if (!selectedScoreSummaryId) {
      alert(
        "Select a score-based AI summary to combine. If the list is empty, generate one from the Score-Based AI Summary tab first.",
      );
      return;
    }
    if (selectedDocSummaryIds.length === 0) {
      alert(
        "Please select at least one Document Summary to generate a Combined Summary.",
      );
      return;
    }

    setGenerating(true);
    try {
      const summary = await combinedReportService.generateCombinedSummary(
        studyId,
        selectedDocSummaryIds,
        selectedScoreSummaryId,
      );
      setActiveSummary(summary);
      setEditedJson(summary.officerEditedOutputJson || summary.aiOutputJson);
      await loadData();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to generate Combined Summary.";
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
      const errorMsg =
        err instanceof Error ? err.message : "Failed to save combined summary.";
      alert(errorMsg);
    } finally {
      setConfirming(false);
    }
  };

  const handleGenerateReportPreview = async () => {
    setGeneratingReport(true);
    try {
      if (activeSummary && activeSummary.status !== "OFFICER_CONFIRMED") {
        await combinedReportService.confirmCombinedSummary(studyId, activeSummary.id);
      }
      await reportsService.create({
        reportType: "RPT16",
        studyId,
      });
      // Stay on the tab and surface the new record in the log below rather than
      // navigating away, so the generation trail is visible where it was made.
      await loadReportLog();
      await loadData();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to generate combined report.";
      alert(errorMsg);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center p-12 text-sm">
        Loading combined report context...
      </div>
    );
  }

  const scoreSummaries = context?.availableScoreSummaries ?? [];
  const scoreSummary =
    scoreSummaries.find((s) => s.id === selectedScoreSummaryId) ?? null;
  const docs = context?.confirmedDocumentSummaries || [];
  const allDocsSelected = docs.length > 0 && selectedDocSummaryIds.length === docs.length;

  // Both summary kinds are required inputs, mirroring the backend's
  // SCORE_SUMMARY_NOT_FOUND / NO_DOCUMENTS_SELECTED validation.
  const canGenerateCombined = Boolean(scoreSummary) && selectedDocSummaryIds.length > 0;

  return (
    <div className="space-y-6">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {/* SECTION 1: SELECTION CONTROLS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/*
          SCORE-BASED SUMMARY SELECTOR
          Lists the score summaries this study actually has and lets the officer
          choose one. Every value shown comes from the selected summary's own
          output — nothing is defaulted, so a study with no generated summary
          reads as empty instead of showing placeholder scores.
        */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Gauge className="text-primary size-5" />
              AI Score-Based Summaries ({scoreSummary ? 1 : 0} / {scoreSummaries.length}{" "}
              selected)
            </CardTitle>
            <CardDescription className="text-xs">
              Choose which score-based AI summary generated for this study to combine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scoreSummaries.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border p-4 text-center text-xs">
                No score-based AI summary has been generated for this study yet. Generate
                one from the Score-Based AI Summary tab to include it here.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Select</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Scores</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoreSummaries.map((option) => {
                      const isSelected = selectedScoreSummaryId === option.id;
                      const output = (option.officerEditedOutputJson ||
                        option.aiOutputJson ||
                        {}) as Record<string, unknown>;
                      const priority =
                        output.priorityScore !== undefined
                          ? String(output.priorityScore)
                          : undefined;
                      const severity =
                        output.overallSeverityScore !== undefined
                          ? String(output.overallSeverityScore)
                          : undefined;
                      const priorityStatus = output.priorityStatus
                        ? String(output.priorityStatus)
                        : "";
                      return (
                        <TableRow
                          key={option.id}
                          className={isSelected ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            {/* Single-select: picking a row replaces the choice. */}
                            <Checkbox
                              checked={isSelected}
                              aria-label={`Select ${option.summaryScope || "score"} summary`}
                              onCheckedChange={() => setSelectedScoreSummaryId(option.id)}
                            />
                          </TableCell>
                          <TableCell className="text-foreground text-xs font-semibold capitalize">
                            {option.summaryScope || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {priority === undefined && severity === undefined ? (
                              "—"
                            ) : (
                              <>
                                {priority !== undefined && (
                                  <span className="block">
                                    Priority {priority}
                                    {priorityStatus ? ` (${priorityStatus})` : ""}
                                  </span>
                                )}
                                {severity !== undefined && (
                                  <span className="block">Severity {severity} / 100</span>
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatTimestamp(option.generatedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                option.status === "OFFICER_CONFIRMED"
                                  ? "default"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {option.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* EVIDENCE DOCUMENT SUMMARIES SELECTOR TABLE */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="text-primary size-5" />
                AI Evidence-Based Summaries ({selectedDocSummaryIds.length} /{" "}
                {docs.length} selected)
              </CardTitle>
              {docs.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Checkbox
                    id="select-all-docs"
                    checked={allDocsSelected}
                    onCheckedChange={(c) => handleSelectAllDocs(!!c)}
                  />
                  <Label
                    htmlFor="select-all-docs"
                    className="cursor-pointer text-xs font-semibold"
                  >
                    Select All
                  </Label>
                </div>
              )}
            </div>
            <CardDescription className="text-xs">
              Qualitative evidence documents belonging to this study & organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border p-4 text-center text-xs">
                No document summaries uploaded yet for this study. Upload a document in
                the Document Summary tab to include it.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Select</TableHead>
                      <TableHead>Document Title</TableHead>
                      <TableHead>Ref ID</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => {
                      const isSelected = selectedDocSummaryIds.includes(
                        doc.confirmedSummary.id,
                      );
                      return (
                        <TableRow
                          key={doc.confirmedSummary.id}
                          className={isSelected ? "bg-primary/5" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                handleDocToggle(doc.confirmedSummary.id)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-foreground text-xs font-semibold">
                            {doc.documentTitle}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {doc.sourceReferenceId}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                doc.confirmedSummary.status === "OFFICER_CONFIRMED"
                                  ? "default"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {doc.confirmedSummary.status || "SAVED"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/*
        GENERATE COMBINED SUMMARY ACTION BUTTON
        A combined summary requires both inputs: the score-based summary and at
        least one evidence-based summary. The button states which one is missing
        rather than sitting disabled with no explanation.
      */}
      <div className="flex flex-col items-center gap-2 py-2">
        <Button
          size="lg"
          onClick={handleGenerateCombinedSummary}
          disabled={generating || !canGenerateCombined}
          className="from-primary to-primary/90 flex items-center gap-2 bg-gradient-to-r px-8 font-bold shadow-md"
        >
          <Sparkles className="size-5" />
          {generating
            ? "Generating AI Combined Summary..."
            : "Generate AI Combined Summary"}
        </Button>
        {!canGenerateCombined && (
          <p className="text-muted-foreground text-xs">
            {!scoreSummary
              ? scoreSummaries.length === 0
                ? "No score-based AI summary exists for this study yet. Generate one from the Score-Based AI Summary tab first."
                : "Select which score-based AI summary to combine."
              : "Select at least one AI evidence-based summary to combine with the score-based summary."}
          </p>
        )}
      </div>

      {/* SECTION 2: RICH COMBINED SUMMARY DISPLAY */}
      {activeSummary && editedJson && (
        <Card className="border-border shadow-md">
          <CardHeader className="bg-muted/10 flex flex-row items-center justify-between border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Sparkles className="text-primary size-5" />
                  AI Combined Summary (Quantitative & Qualitative)
                </CardTitle>
                <Badge
                  variant={
                    activeSummary.status === "OFFICER_CONFIRMED" ? "default" : "secondary"
                  }
                >
                  {activeSummary.status === "OFFICER_CONFIRMED"
                    ? "CONFIRMED & SAVED"
                    : "DRAFT"}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Synthesized from quantitative survey score baseline and{" "}
                {selectedDocSummaryIds.length} qualitative evidence document summaries.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canAi && activeSummary.status !== "OFFICER_CONFIRMED" && (
                <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
                  <Edit3 className="mr-1 size-4" />
                  {editing ? "Preview View" : "Edit Draft"}
                </Button>
              )}
              {canAi && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleConfirmCombinedSummary}
                  disabled={confirming}
                >
                  <Save className="mr-1 size-4" />
                  {confirming ? "Saving..." : "Save Summary"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleGenerateReportPreview}
                disabled={generatingReport}
                className="flex items-center gap-1.5 font-bold"
              >
                <FileCheck className="size-4" />
                {generatingReport ? "Generating Report..." : "Generate Combined Report"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">
                    Executive Summary Narrative
                  </Label>
                  <Textarea
                    rows={6}
                    value={String(editedJson?.executiveSummary || "")}
                    onChange={(e) =>
                      setEditedJson({ ...editedJson, executiveSummary: e.target.value })
                    }
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* 1. EXECUTIVE SUMMARY */}
                <div className="bg-card space-y-2 rounded-lg border p-4">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <Sparkles className="text-primary size-4" />
                    1. Executive Combined Overview
                  </h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {String(
                      editedJson?.executiveSummary ||
                        "Unified synthesis of quantitative survey findings and qualitative field evidence.",
                    )}
                  </p>
                </div>

                {/* 2. QUANTITATIVE SCORE MATRIX */}
                <div className="bg-card space-y-3 rounded-lg border p-4">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <BarChart2 className="text-primary size-4" />
                    2. Quantitative Score-Based Metrics
                  </h3>
                  {(() => {
                    const sb = editedJson?.scoreBasedFindings as
                      Record<string, unknown> | undefined;
                    return (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="bg-muted/20 rounded-md border p-3">
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                            Severity Index
                          </p>
                          <p className="text-foreground mt-0.5 text-xl font-bold">
                            {sb?.overallSeverityScore !== undefined
                              ? `${String(sb.overallSeverityScore)} / 100`
                              : "—"}
                          </p>
                        </div>
                        <div className="bg-muted/20 rounded-md border p-3">
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                            Priority Score
                          </p>
                          <p className="text-foreground mt-0.5 text-xl font-bold">
                            {String(sb?.priorityScore ?? "—")}
                          </p>
                        </div>
                        <div className="bg-muted/20 rounded-md border p-3">
                          <p className="text-muted-foreground text-[10px] font-semibold uppercase">
                            Priority Level
                          </p>
                          <Badge className="mt-1 font-bold">
                            {String(sb?.priorityStatus ?? "—")}
                          </Badge>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 3. QUALITATIVE EVIDENCE MATRIX */}
                <div className="bg-card space-y-3 rounded-lg border p-4">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <Layers className="text-primary size-4" />
                    3. Qualitative Evidence Documents (
                    {(context?.confirmedDocumentSummaries || []).length} Documents)
                  </h3>
                  <div className="space-y-2">
                    {(
                      (editedJson?.documentBasedEvidence as Record<string, unknown>[]) ||
                      (context?.confirmedDocumentSummaries || []).map((d) => ({
                        documentTitle: d.documentTitle,
                        sourceReferenceId: d.sourceReferenceId,
                        documentType: d.documentType,
                        keyEvidenceFinding:
                          "Qualitative evidence document analysis integrated.",
                      }))
                    ).map((ev: Record<string, unknown>, i: number) => (
                      <div
                        key={i}
                        className="bg-muted/10 space-y-1 rounded-md border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-foreground font-bold">
                            {String(ev.documentTitle || "")}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            Ref: {String(ev.sourceReferenceId || "")}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {String(ev.keyEvidenceFinding || "")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. COMPARATIVE ANALYSIS & THEME COMPARISON */}
                <div className="bg-card space-y-3 rounded-lg border p-4">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck className="text-primary size-4" />
                    4. Comparative Analysis & Theme Comparison
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="bg-primary/5 space-y-1 rounded-md border p-3">
                      <p className="text-primary text-xs font-bold">
                        Score vs. Document Alignment
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Survey scores and qualitative field reports align on high severity
                        in Water & Sanitation infrastructure.
                      </p>
                    </div>
                    <div className="bg-warning/10 space-y-1 rounded-md border p-3">
                      <p className="text-foreground text-xs font-bold">
                        Operational Gaps &amp; Nuances
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Field evidence highlights staffing shortages in primary health
                        centers not fully reflected in raw quantitative survey scores.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. RECOMMENDATIONS */}
                <div className="bg-card space-y-3 rounded-lg border p-4">
                  <h3 className="text-foreground flex items-center gap-2 text-sm font-bold">
                    <CheckCircle2 className="text-primary size-4" />
                    5. Integrated Recommendations & Action Plan
                  </h3>
                  <ul className="space-y-1.5">
                    {(
                      (editedJson?.recommendations as (
                        Record<string, unknown> | string
                      )[]) || [
                        {
                          intervention:
                            "Prioritize municipal water line maintenance and filtration unit deployments.",
                          priority: "HIGH",
                        },
                        {
                          intervention:
                            "Schedule follow-up qualitative field assessments in secondary centers.",
                          priority: "MEDIUM",
                        },
                        {
                          intervention:
                            "Integrate document-based evidence findings into quarterly budget allocation.",
                          priority: "HIGH",
                        },
                      ]
                    ).map((r: Record<string, unknown> | string, i: number) => (
                      <li
                        key={i}
                        className="bg-muted/20 flex items-start gap-2 rounded border p-2 text-xs"
                      >
                        <ArrowRight className="text-primary mt-0.5 size-4 shrink-0" />
                        <div>
                          <span className="text-foreground font-semibold">
                            {typeof r === "string" ? r : String(r.intervention || "")}
                          </span>
                          {typeof r !== "string" && r.priority ? (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[9px] uppercase"
                            >
                              {String(r.priority)} Priority
                            </Badge>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/*
        GENERATED COMBINED REPORT LOG
        Every RPT16 record produced for this study, newest first. Sits directly
        below the generation controls so a generated report is visible in place
        instead of only on the global Reports page.
      */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <FileCheck className="text-primary size-5" />
            Generated Combined Reports
            {reportLog.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {reportLog.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Combined Evidence &amp; Score Reports (RPT16) generated for this study.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {reportLogError ? (
            <p className="text-destructive p-4 text-xs">{reportLogError}</p>
          ) : reportLog.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-xs">
              No combined reports generated yet for this study.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Generated By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportLog.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="text-foreground text-xs font-semibold">
                      {report.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          report.status === "released"
                            ? "default"
                            : report.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[10px] uppercase"
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTimestamp(report.generatedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {report.generatedByName || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => router.push(`/reports/${report.id}`)}
                      >
                        <Eye className="size-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
