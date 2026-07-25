"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Edit3,
  Save,
  Trash2,
  Eye,
  History,
  ShieldAlert,
  ArrowRight,
  Info,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePermission } from "@/hooks/use-permission";
import {
  prioritySummaryService,
  PrioritySummaryRecord,
  PrioritySummaryOutput,
  PrioritySummaryResponse,
  SummaryScopeType,
} from "@/services/reports/priority-summary.service";
import { GenerateSummaryModal } from "./generate-summary-modal";
import { SaveReportModal } from "./save-report-modal";

export function AiPrioritySummaryPanel({
  studyId,
  surveyId,
  villageId = "",
  villages = [],
  hasSeverityScoring = true,
  hasPriorityScoring = true,
}: {
  studyId: string;
  surveyId: string;
  villageId?: string;
  villages?: string[];
  hasSeverityScoring?: boolean;
  hasPriorityScoring?: boolean;
}) {
  const t = useTranslations("PriorityDashboard.summaryPanel");
  const canCreate = usePermission("priorityScoring", "create");
  const canWrite = usePermission("priorityScoring", "write");

  const [activeScope, setActiveScope] = useState<SummaryScopeType>("VILLAGE");
  const [record, setRecord] = useState<PrioritySummaryRecord | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Saved Summaries Table State
  const [savedSummaries, setSavedSummaries] = useState<PrioritySummaryRecord[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [viewSummary, setViewSummary] = useState<PrioritySummaryRecord | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [saveReportModalOpen, setSaveReportModalOpen] = useState(false);

  // Editable output state
  const [draftOutput, setDraftOutput] = useState<PrioritySummaryOutput | null>(null);
  const [editedExecutiveSummary, setEditedExecutiveSummary] = useState("");
  const [editedPriorityExplanation, setEditedPriorityExplanation] = useState("");

  // Audit History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<PrioritySummaryRecord[]>([]);

  const loadSummary = useCallback(
    (scopeToLoad: SummaryScopeType = activeScope) => {
      setLoading(true);
      prioritySummaryService
        .getSummary(studyId, surveyId, scopeToLoad, villageId)
        .then((res) => {
          if (res && res.summary) {
            setRecord(res.summary);
            setSnapshot(res.snapshot);
            const activeOutput =
              res.summary.officerEditedOutputJson || res.summary.aiOutputJson;
            setDraftOutput(activeOutput);
            setEditedExecutiveSummary(activeOutput.executiveSummary || "");
            setEditedPriorityExplanation(activeOutput.priorityExplanation || "");
          } else {
            setRecord(null);
            setSnapshot(res?.snapshot || null);
            setDraftOutput(null);
          }
        })
        .catch(() => setRecord(null))
        .finally(() => setLoading(false));
    },
    [studyId, surveyId, villageId, activeScope],
  );

  const loadSavedSummariesTable = useCallback(() => {
    setLoadingSaved(true);
    prioritySummaryService
      .getSavedSummariesList(studyId, surveyId)
      .then((list) => setSavedSummaries(list || []))
      .catch(() => setSavedSummaries([]))
      .finally(() => setLoadingSaved(false));
  }, [studyId, surveyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSummary(activeScope);
    loadSavedSummariesTable();
  }, [loadSummary, loadSavedSummariesTable, activeScope]);

  const handleGeneratedFromModal = (res: PrioritySummaryResponse) => {
    if (res && res.summary) {
      setActiveScope(res.summary.summaryScope || "VILLAGE");
      setRecord(res.summary);
      setSnapshot(res.snapshot);
      const activeOutput =
        res.summary.officerEditedOutputJson || res.summary.aiOutputJson;
      setDraftOutput(activeOutput);
      setEditedExecutiveSummary(activeOutput.executiveSummary || "");
      setEditedPriorityExplanation(activeOutput.priorityExplanation || "");
      loadSavedSummariesTable();
    }
  };

  const handleSaveSummary = async () => {
    if (!record) return;
    try {
      setSaving(true);
      const updatedOutput: PrioritySummaryOutput = {
        ...(draftOutput || record.aiOutputJson),
        executiveSummary: editedExecutiveSummary,
        priorityExplanation: editedPriorityExplanation,
      };
      const saved = await prioritySummaryService.saveSummary(record.id, updatedOutput);
      setRecord(saved);
      setEditing(false);
      loadSavedSummariesTable();
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (summaryId: string) => {
    try {
      await prioritySummaryService.deleteSavedSummary(summaryId);
      loadSavedSummariesTable();
      if (record?.id === summaryId) {
        loadSummary(activeScope);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenHistory = async () => {
    try {
      setHistoryOpen(true);
      const list = await prioritySummaryService.getSummaryHistory(
        studyId,
        surveyId,
        activeScope,
      );
      setHistoryList(list);
    } catch (err) {
      console.error(err);
    }
  };

  const isReady = hasSeverityScoring && hasPriorityScoring && Boolean(surveyId);
  const approvedEvidenceCount = snapshot?.evidence?.length || 0;

  if (loading) {
    return (
      <Card className="border-border shadow-sm">
        <CardContent className="space-y-3 p-6">
          <div className="bg-muted h-6 w-1/3 animate-pulse rounded" />
          <div className="bg-muted h-32 w-full animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const activeOutput =
    draftOutput || record?.officerEditedOutputJson || record?.aiOutputJson;

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* UPPER SECTION: AI SUMMARY GENERATOR & WORKSPACE           */}
      {/* ========================================================= */}
      {!record ? (
        <Card className="border-primary/20 bg-card shadow-sm">
          <CardHeader className="bg-muted/20 border-border flex flex-row items-center justify-between border-b px-6 py-4">
            <CardTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
              <Sparkles className="text-primary size-5" />
              {t("generatorTitle")}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {(["VILLAGE", "SECTOR", "REGION", "EXECUTIVE"] as SummaryScopeType[]).map(
                (s) => (
                  <Button
                    key={s}
                    variant={activeScope === s ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveScope(s)}
                    className="h-7 px-2.5 text-xs"
                  >
                    {s}
                  </Button>
                ),
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <p className="text-muted-foreground text-xs">
              Generate a draft summary narrative from current Severity Score, Priority
              Score, confidence data, and approved evidence for{" "}
              <strong className="text-foreground">
                {t("levelBadge", { scope: activeScope })}
              </strong>
              .
            </p>

            <div className="bg-muted/30 border-border space-y-2.5 rounded-lg border p-4 text-xs">
              <p className="text-foreground font-semibold">{t("checklistTitle")}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-success size-4" />
                  <span>{t("severityComplete")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-success size-4" />
                  <span>{t("priorityComplete")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-success size-4" />
                  <span>{t("snapshotReady")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="text-primary size-4" />
                  <span>{t("approvedSelected", { count: approvedEvidenceCount })}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setModalOpen(true)}
                disabled={!isReady || !canCreate}
                className="gap-2"
              >
                <Sparkles className="size-4" />
                {t("generateButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={`border-primary/30 shadow-sm ${record.status === "STALE" ? "border-amber-500/50 bg-amber-500/5" : ""}`}
        >
          <CardHeader className="bg-muted/20 border-border flex flex-col justify-between gap-3 border-b px-6 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <Sparkles className="text-primary size-5" />
              <div>
                <CardTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
                  {t("workspaceTitle")}
                  <Badge
                    variant="outline"
                    className="text-primary border-primary/40 text-xs font-semibold uppercase"
                  >
                    {t("levelBadge", { scope: record.summaryScope })}
                  </Badge>
                  <Badge
                    variant={
                      record.status === "SAVED" || record.status === "OFFICER_CONFIRMED"
                        ? "secondary"
                        : record.status === "STALE"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-xs font-semibold uppercase"
                  >
                    {record.status}
                  </Badge>
                </CardTitle>
              </div>
            </div>

            {/* 3 MAIN ACTIONS: 1-REGENERATE | 2-EDIT | 3-SAVE */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenHistory}
                className="gap-1.5 text-xs"
              >
                <History className="size-3.5" />
                {t("historyButton")}
              </Button>

              {/* ACTION 1: REGENERATE */}
              {canCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="text-primary size-3.5" />
                  {t("regenerateButton")}
                </Button>
              )}

              {/* ACTION 2: EDIT */}
              {canWrite && !editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                  className="gap-1.5 text-xs"
                >
                  <Edit3 className="text-primary size-3.5" />
                  {t("editButton")}
                </Button>
              )}

              {/* ACTION 3: SAVE */}
              {canWrite && (
                <Button
                  size="sm"
                  onClick={handleSaveSummary}
                  disabled={saving}
                  className="gap-1.5 text-xs"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {t("saveButton")}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {record.status === "STALE" && (
              <div className="flex items-start gap-2.5 rounded-lg border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">{t("staleAlertTitle")}</p>
                  <p>{t("staleAlertDesc")}</p>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="space-y-2">
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("executiveSummaryTitle")}
              </h4>
              {editing ? (
                <Textarea
                  value={editedExecutiveSummary}
                  onChange={(e) => setEditedExecutiveSummary(e.target.value)}
                  className="min-h-28 text-xs"
                />
              ) : (
                <p className="text-foreground bg-muted/30 border-border/50 rounded-md border p-3.5 text-xs leading-relaxed whitespace-pre-line">
                  {activeOutput?.executiveSummary}
                </p>
              )}
            </div>

            {/* Priority Explanation */}
            <div className="space-y-2">
              <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("priorityExplanationTitle")}
              </h4>
              {editing ? (
                <Textarea
                  value={editedPriorityExplanation}
                  onChange={(e) => setEditedPriorityExplanation(e.target.value)}
                  className="min-h-24 text-xs"
                />
              ) : (
                <p className="text-foreground bg-muted/30 border-border/50 rounded-md border p-3.5 text-xs leading-relaxed whitespace-pre-line">
                  {activeOutput?.priorityExplanation}
                </p>
              )}
            </div>

            {/* Key Findings */}
            {activeOutput?.keyFindings && activeOutput.keyFindings.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("keyFindingsTitle")}
                </h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {activeOutput.keyFindings.map((kf, idx) => (
                    <div
                      key={idx}
                      className="bg-card border-border space-y-1.5 rounded-lg border p-3 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{kf.title}</span>
                        {kf.severityScore !== null && (
                          <Badge variant="destructive" className="text-[10px]">
                            {t("severityLabel")}: {Math.round(kf.severityScore)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {t("domainLabel")}: {kf.domain} | {t("kpiLabel")}: {kf.kpi}
                      </p>
                      <p className="text-foreground leading-normal">{kf.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Metadata Footer */}
            <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px]">
              <div className="flex flex-wrap items-center gap-3">
                <span>Scope: {record.summaryScope}</span>
                <span>•</span>
                <span>
                  {t("promptLabel")}: {record.promptVersion}
                </span>
                <span>•</span>
                <span>
                  {t("generatedLabel")}: {new Date(record.generatedAt).toLocaleString()}
                </span>
              </div>

              {(record.status === "SAVED" || record.status === "OFFICER_CONFIRMED") && (
                <Button
                  size="sm"
                  onClick={() => setSaveReportModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <FileText className="size-3.5" />
                  {t("generateReportButton", { scope: record.summaryScope })}
                  <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================= */}
      {/* LOWER SECTION: SAVED AI SUMMARIES TABLE (MULTI-TENANT)   */}
      {/* ========================================================= */}
      <Card className="border-border shadow-sm">
        <CardHeader className="bg-muted/20 border-border flex flex-row items-center justify-between border-b px-6 py-4">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2 text-base font-semibold">
              <Save className="text-primary size-4" />
              {t("savedTitle")}
            </CardTitle>
            <p className="text-muted-foreground mt-0.5 text-xs">{t("savedSubtitle")}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {t("savedCount", { count: savedSummaries.length })}
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {loadingSaved ? (
            <div className="text-muted-foreground animate-pulse p-6 text-center text-xs">
              Loading organization saved summaries...
            </div>
          ) : savedSummaries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">{t("tableHeaders.scope")}</TableHead>
                  <TableHead>{t("tableHeaders.target")}</TableHead>
                  <TableHead>{t("tableHeaders.status")}</TableHead>
                  <TableHead>{t("tableHeaders.snippet")}</TableHead>
                  <TableHead>{t("tableHeaders.savedDate")}</TableHead>
                  <TableHead className="text-right">
                    {t("tableHeaders.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedSummaries.map((s) => {
                  const out = s.officerEditedOutputJson || s.aiOutputJson;
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  const filters = (s.scopeFilters as any) || {};
                  const filterLabel =
                    filters.domainKey ||
                    filters.regionId ||
                    filters.villageId ||
                    s.villageId ||
                    "Consolidated Villages";

                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-primary text-[10px] font-semibold uppercase"
                        >
                          {s.summaryScope}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground text-xs font-medium">
                        {filterLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                        {out?.executiveSummary || "N/A"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(s.updatedAt || s.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewSummary(s)}
                          className="h-8 gap-1 px-2 text-xs"
                        >
                          <Eye className="text-primary size-3.5" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSaved(s.id)}
                          className="text-destructive hover:text-destructive h-8 gap-1 px-2 text-xs"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-muted-foreground p-8 text-center text-xs">
              No saved AI summaries available for this organization yet. Click{" "}
              <strong>Save</strong> in the section above to archive a summary.
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIEW FULL SAVED SUMMARY DIALOG */}
      <Dialog open={Boolean(viewSummary)} onOpenChange={() => setViewSummary(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="text-primary size-5" />
              Saved Summary Details — {viewSummary?.summaryScope} Scope
            </DialogTitle>
            <DialogDescription className="text-xs">
              Saved on{" "}
              {viewSummary
                ? new Date(
                    viewSummary.updatedAt || viewSummary.createdAt,
                  ).toLocaleString()
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewSummary ? (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pt-2 text-xs">
              <div className="bg-muted/30 space-y-1 rounded-md p-3">
                <span className="text-foreground font-semibold">Executive Summary:</span>
                <p className="text-muted-foreground whitespace-pre-line">
                  {
                    (viewSummary.officerEditedOutputJson || viewSummary.aiOutputJson)
                      ?.executiveSummary
                  }
                </p>
              </div>

              <div className="bg-muted/30 space-y-1 rounded-md p-3">
                <span className="text-foreground font-semibold">
                  Priority Explanation:
                </span>
                <p className="text-muted-foreground whitespace-pre-line">
                  {
                    (viewSummary.officerEditedOutputJson || viewSummary.aiOutputJson)
                      ?.priorityExplanation
                  }
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* AUDIT HISTORY DIALOG */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <History className="text-primary size-4" />
              Summary Audit History ({activeScope})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every generation and save creates an auditable record.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 space-y-3 overflow-y-auto pt-2">
            {historyList.map((h) => (
              <div
                key={h.id}
                className="bg-muted/20 space-y-1 rounded-lg border p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={h.status === "SAVED" ? "secondary" : "outline"}>
                    {h.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(h.generatedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Prompt: {h.promptVersion} | Scope: {h.summaryScope}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* GENERATE SUMMARY MODAL */}
      <GenerateSummaryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        studyId={studyId}
        surveyId={surveyId}
        villages={villages}
        onGenerated={handleGeneratedFromModal}
      />

      {/* SAVE REPORT MODAL */}
      {record ? (
        <SaveReportModal
          open={saveReportModalOpen}
          onOpenChange={setSaveReportModalOpen}
          summaryId={record.id}
          studyId={studyId}
          scope={record.summaryScope}
        />
      ) : null}
    </div>
  );
}
