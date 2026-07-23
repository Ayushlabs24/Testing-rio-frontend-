"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
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
  Layers,
  Building2,
  Globe,
  MapPin,
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
  const canCreate = usePermission("priorityScoring", "create");
  const canWrite = usePermission("priorityScoring", "write");

  const [activeScope, setActiveScope] = useState<SummaryScopeType>("VILLAGE");
  const [record, setRecord] = useState<PrioritySummaryRecord | null>(null);
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

  function loadSummary(scopeToLoad: SummaryScopeType = activeScope) {
    setLoading(true);
    prioritySummaryService
      .getSummary(studyId, surveyId, scopeToLoad, villageId)
      .then((res) => {
        if (res && res.summary) {
          setRecord(res.summary);
          setSnapshot(res.snapshot);
          const activeOutput = res.summary.officerEditedOutputJson || res.summary.aiOutputJson;
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
  }

  function loadSavedSummariesTable() {
    setLoadingSaved(true);
    prioritySummaryService
      .getSavedSummariesList(studyId, surveyId)
      .then((list) => setSavedSummaries(list || []))
      .catch(() => setSavedSummaries([]))
      .finally(() => setLoadingSaved(false));
  }

  useEffect(() => {
    loadSummary(activeScope);
    loadSavedSummariesTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, surveyId, villageId, activeScope]);

  const handleGeneratedFromModal = (res: any) => {
    if (res && res.summary) {
      setActiveScope(res.summary.summaryScope || "VILLAGE");
      setRecord(res.summary);
      setSnapshot(res.snapshot);
      const activeOutput = res.summary.officerEditedOutputJson || res.summary.aiOutputJson;
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
    } catch (err: any) {
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
      const list = await prioritySummaryService.getSummaryHistory(studyId, surveyId, activeScope);
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
        <CardContent className="p-6 space-y-3">
          <div className="bg-muted h-6 w-1/3 animate-pulse rounded" />
          <div className="bg-muted h-32 w-full animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  const activeOutput = draftOutput || record?.officerEditedOutputJson || record?.aiOutputJson;

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* UPPER SECTION: AI SUMMARY GENERATOR & WORKSPACE           */}
      {/* ========================================================= */}
      {!record ? (
        <Card className="border-primary/20 bg-card shadow-sm">
          <CardHeader className="py-4 px-6 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI Priority Summary Generator
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {(["VILLAGE", "SECTOR", "REGION", "EXECUTIVE"] as SummaryScopeType[]).map((s) => (
                <Button
                  key={s}
                  variant={activeScope === s ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveScope(s)}
                  className="text-xs h-7 px-2.5"
                >
                  {s}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <p className="text-xs text-muted-foreground">
              Generate a draft summary narrative from current Severity Score, Priority Score, confidence data, and approved evidence for <strong className="text-foreground">{activeScope} LEVEL</strong>.
            </p>

            <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-2.5 text-xs">
              <p className="font-semibold text-foreground">Pre-generation Validation Checklist:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>Severity Scoring Complete: Yes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>Priority Scoring Complete: Yes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>ReportData Snapshot Ready: Yes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  <span>Approved Evidence Selected: {approvedEvidenceCount} items</span>
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
                Generate AI Summary
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className={`border-primary/30 shadow-sm ${record.status === "STALE" ? "border-amber-500/50 bg-amber-500/5" : ""}`}>
          <CardHeader className="py-4 px-6 bg-muted/20 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  AI Priority Summary Workspace
                  <Badge variant="outline" className="text-xs uppercase font-semibold text-primary border-primary/40">
                    {record.summaryScope} LEVEL
                  </Badge>
                  <Badge
                    variant={
                      record.status === "SAVED" || record.status === "OFFICER_CONFIRMED"
                        ? "secondary"
                        : record.status === "STALE"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-xs uppercase font-semibold"
                  >
                    {record.status}
                  </Badge>
                </CardTitle>
              </div>
            </div>

            {/* 3 MAIN ACTIONS: 1-REGENERATE | 2-EDIT | 3-SAVE */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleOpenHistory} className="gap-1.5 text-xs">
                <History className="size-3.5" />
                History
              </Button>

              {/* ACTION 1: REGENERATE */}
              {canCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="size-3.5 text-primary" />
                  Regenerate
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
                  <Edit3 className="size-3.5 text-primary" />
                  Edit
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
                  Save
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {record.status === "STALE" && (
              <div className="border-amber-500/40 bg-amber-500/10 p-3.5 rounded-lg flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Scoring or evidence changed.</p>
                  <p>Regenerate a new AI Summary to reflect latest priority data.</p>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Executive Summary Narrative</h4>
              {editing ? (
                <Textarea
                  value={editedExecutiveSummary}
                  onChange={(e) => setEditedExecutiveSummary(e.target.value)}
                  className="text-xs min-h-28"
                />
              ) : (
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-muted/30 p-3.5 rounded-md border border-border/50">
                  {activeOutput?.executiveSummary}
                </p>
              )}
            </div>

            {/* Priority Explanation */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Why this village/scope has Priority Status
              </h4>
              {editing ? (
                <Textarea
                  value={editedPriorityExplanation}
                  onChange={(e) => setEditedPriorityExplanation(e.target.value)}
                  className="text-xs min-h-24"
                />
              ) : (
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-muted/30 p-3.5 rounded-md border border-border/50">
                  {activeOutput?.priorityExplanation}
                </p>
              )}
            </div>

            {/* Key Findings */}
            {activeOutput?.keyFindings && activeOutput.keyFindings.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Findings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeOutput.keyFindings.map((kf, idx) => (
                    <div key={idx} className="bg-card border border-border p-3 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{kf.title}</span>
                        {kf.severityScore !== null && (
                          <Badge variant="destructive" className="text-[10px]">
                            Severity: {kf.severityScore}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">Domain: {kf.domain} | KPI: {kf.kpi}</p>
                      <p className="text-foreground leading-normal">{kf.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Metadata Footer */}
            <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <div className="flex flex-wrap items-center gap-3">
                <span>Scope: {record.summaryScope}</span>
                <span>•</span>
                <span>Prompt: {record.promptVersion}</span>
                <span>•</span>
                <span>Generated: {new Date(record.generatedAt).toLocaleString()}</span>
              </div>

              {(record.status === "SAVED" || record.status === "OFFICER_CONFIRMED") && (
                <Button size="sm" onClick={() => setSaveReportModalOpen(true)} className="gap-1.5 text-xs">
                  <FileText className="size-3.5" />
                  Generate {record.summaryScope} Report
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
        <CardHeader className="py-4 px-6 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Save className="size-4 text-primary" />
              Saved Organization AI Summaries
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Archived summaries saved for this organization under multi-tenant isolation.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {savedSummaries.length} Saved Record(s)
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {loadingSaved ? (
            <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
              Loading organization saved summaries...
            </div>
          ) : savedSummaries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Scope</TableHead>
                  <TableHead>Target / Filter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executive Summary Snippet</TableHead>
                  <TableHead>Saved Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedSummaries.map((s) => {
                  const out = s.officerEditedOutputJson || s.aiOutputJson;
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
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold text-primary">
                          {s.summaryScope}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-xs text-foreground">
                        {filterLabel}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {out?.executiveSummary || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.updatedAt || s.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewSummary(s)}
                          className="h-8 px-2 text-xs gap-1"
                        >
                          <Eye className="size-3.5 text-primary" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSaved(s.id)}
                          className="h-8 px-2 text-xs text-destructive hover:text-destructive gap-1"
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
            <div className="p-8 text-center text-xs text-muted-foreground">
              No saved AI summaries available for this organization yet. Click <strong>Save</strong> in the section above to archive a summary.
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIEW FULL SAVED SUMMARY DIALOG */}
      <Dialog open={Boolean(viewSummary)} onOpenChange={() => setViewSummary(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Saved Summary Details — {viewSummary?.summaryScope} Scope
            </DialogTitle>
            <DialogDescription className="text-xs">
              Saved on {viewSummary ? new Date(viewSummary.updatedAt || viewSummary.createdAt).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>

          {viewSummary ? (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pt-2 text-xs">
              <div className="bg-muted/30 p-3 rounded-md space-y-1">
                <span className="font-semibold text-foreground">Executive Summary:</span>
                <p className="text-muted-foreground whitespace-pre-line">
                  {(viewSummary.officerEditedOutputJson || viewSummary.aiOutputJson)?.executiveSummary}
                </p>
              </div>

              <div className="bg-muted/30 p-3 rounded-md space-y-1">
                <span className="font-semibold text-foreground">Priority Explanation:</span>
                <p className="text-muted-foreground whitespace-pre-line">
                  {(viewSummary.officerEditedOutputJson || viewSummary.aiOutputJson)?.priorityExplanation}
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
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="size-4 text-primary" />
              Summary Audit History ({activeScope})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every generation and save creates an auditable record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto pt-2">
            {historyList.map((h) => (
              <div key={h.id} className="p-3 border rounded-lg bg-muted/20 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant={h.status === "SAVED" ? "secondary" : "outline"}>
                    {h.status}
                  </Badge>
                  <span className="text-muted-foreground">{new Date(h.generatedAt).toLocaleString()}</span>
                </div>
                <p className="text-muted-foreground text-[11px]">Prompt: {h.promptVersion} | Scope: {h.summaryScope}</p>
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
