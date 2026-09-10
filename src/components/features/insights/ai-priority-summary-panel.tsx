"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { formatDateTime } from "@/lib/format-date";
import type { AppLocale } from "@/i18n/routing";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
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
import {
  parsePrioritySummarySnapshot,
  type PrioritySummarySnapshot,
} from "@/services/reports/priority-summary.schemas";
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
  const locale = useLocale() as AppLocale;
  const canCreate = usePermission("priorityScoring", "create");
  const canWrite = usePermission("priorityScoring", "write");
  const { localizedDomain } = useDomainArabicMap();
  // Scope/status are fixed, finite vocabularies (not user data), so a plain
  // t()-lookup is correct here — same reasoning as every other
  // fixed-status-Select pattern in the app (e.g. Initiative status).
  const tScope = (scope: SummaryScopeType) =>
    t.has(`scope.${scope}`) ? t(`scope.${scope}` as Parameters<typeof t>[0]) : scope;
  const tStatus = (status: PrioritySummaryRecord["status"]) =>
    t.has(`status.${status}`) ? t(`status.${status}` as Parameters<typeof t>[0]) : status;

  const [activeScope, setActiveScope] = useState<SummaryScopeType>("VILLAGE");
  const [record, setRecord] = useState<PrioritySummaryRecord | null>(null);
  const [snapshot, setSnapshot] = useState<PrioritySummarySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
            setSnapshot(parsePrioritySummarySnapshot(res.snapshot));
            const activeOutput =
              res.summary.officerEditedOutputJson || res.summary.aiOutputJson;
            setDraftOutput(activeOutput);
            setEditedExecutiveSummary(activeOutput.executiveSummary || "");
            setEditedPriorityExplanation(activeOutput.priorityExplanation || "");
          } else {
            setRecord(null);
            setSnapshot(
              res?.snapshot ? parsePrioritySummarySnapshot(res.snapshot) : null,
            );
            setDraftOutput(null);
          }
        })
        .catch((err: unknown) => {
          setRecord(null);
          // Distinguishes "no summary generated yet" (empty response, no
          // error banner) from an actual load failure — without this the
          // Generator card renders either way and a real fetch failure
          // looks identical to a study that just has no summary.
          setActionError(err instanceof Error ? err.message : t("loadSummaryError"));
        })
        .finally(() => setLoading(false));
    },
    [studyId, surveyId, villageId, activeScope],
  );

  const loadSavedSummariesTable = useCallback(() => {
    setLoadingSaved(true);
    prioritySummaryService
      .getSavedSummariesList(studyId, surveyId)
      .then((list) => setSavedSummaries(list || []))
      .catch((err: unknown) => {
        setSavedSummaries([]);
        setActionError(err instanceof Error ? err.message : t("loadSavedError"));
      })
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
    setActionError(null);
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
      setActionError(err instanceof Error ? err.message : t("saveSummaryError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (summaryId: string) => {
    setActionError(null);
    try {
      await prioritySummaryService.deleteSavedSummary(summaryId);
      loadSavedSummariesTable();
      if (record?.id === summaryId) {
        loadSummary(activeScope);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : t("deleteSavedError"));
    }
  };

  const handleOpenHistory = async () => {
    setActionError(null);
    try {
      setHistoryOpen(true);
      const list = await prioritySummaryService.getSummaryHistory(
        studyId,
        surveyId,
        activeScope,
      );
      setHistoryList(list);
    } catch (err: unknown) {
      setHistoryOpen(false);
      setActionError(err instanceof Error ? err.message : t("loadHistoryError"));
    }
  };

  const isReady = hasSeverityScoring && hasPriorityScoring && Boolean(surveyId);
  const approvedEvidenceCount = Array.isArray(snapshot?.evidence)
    ? snapshot.evidence.length
    : 0;

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
      {actionError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 rounded-lg border p-4 text-sm"
        >
          <p className="text-destructive font-semibold">
            <AutoTranslate text={actionError} />
          </p>
        </div>
      ) : null}

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
                    {tScope(s)}
                  </Button>
                ),
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <p className="text-muted-foreground text-xs">
              {t("generatorDescription", {
                level: t("levelBadge", { scope: tScope(activeScope) }),
              })}
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
                    {t("levelBadge", { scope: tScope(record.summaryScope) })}
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
                    {tStatus(record.status)}
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
                  <AutoTranslate text={activeOutput?.executiveSummary} />
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
                  <AutoTranslate text={activeOutput?.priorityExplanation} />
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
                        <span>
                          <AutoTranslate text={kf.title} />
                        </span>
                        {kf.severityScore !== null && (
                          <Badge variant="destructive" className="text-[10px]">
                            {t("severityLabel")}: {Math.round(kf.severityScore)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {t("domainLabel")}: {localizedDomain(kf.domain)} | {t("kpiLabel")}
                        : {kf.kpi}
                      </p>
                      <p className="text-foreground leading-normal">
                        <AutoTranslate text={kf.summary} />
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Metadata Footer */}
            <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px]">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  {t("scopeFooterLabel", { scope: tScope(record.summaryScope) })}
                </span>
                <span>•</span>
                <span>
                  {t("promptLabel")}: {record.promptVersion}
                </span>
                <span>•</span>
                <span>
                  {t("generatedLabel")}:{" "}
                  <FormattedDate value={record.generatedAt} withTime />
                </span>
              </div>

              {(record.status === "SAVED" || record.status === "OFFICER_CONFIRMED") && (
                <Button
                  size="sm"
                  onClick={() => setSaveReportModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <FileText className="size-3.5" />
                  {t("generateReportButton", { scope: tScope(record.summaryScope) })}
                  <ArrowRight className="size-3.5 rtl:rotate-180" />
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
              {t("loadingSaved")}
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
                  const filters = s.scopeFilters || {};
                  const rawFilterLabel =
                    filters.domainKey ||
                    filters.regionId ||
                    filters.villageId ||
                    s.villageId ||
                    null;

                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-primary text-[10px] font-semibold uppercase"
                        >
                          {tScope(s.summaryScope)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground text-xs font-medium">
                        {rawFilterLabel ? (
                          <AutoTranslate text={rawFilterLabel} />
                        ) : (
                          t("consolidatedVillages")
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {tStatus(s.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                        {out?.executiveSummary ? (
                          <AutoTranslate text={out.executiveSummary} />
                        ) : (
                          t("naLabel")
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <FormattedDate value={s.updatedAt || s.createdAt} withTime />
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewSummary(s)}
                          className="h-8 gap-1 px-2 text-xs"
                        >
                          <Eye className="text-primary size-3.5" />
                          {t("viewAction")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSaved(s.id)}
                          className="text-destructive hover:text-destructive h-8 gap-1 px-2 text-xs"
                        >
                          <Trash2 className="size-3.5" />
                          {t("deleteAction")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-muted-foreground p-8 text-center text-xs">
              {t("noSavedSummaries")}
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
              {t("savedDetailsTitle", {
                scope: viewSummary ? tScope(viewSummary.summaryScope) : "",
              })}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("savedOnDate", {
                date: viewSummary
                  ? formatDateTime(viewSummary.updatedAt || viewSummary.createdAt, locale)
                  : "",
              })}
            </DialogDescription>
          </DialogHeader>

          {viewSummary ? (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pt-2 text-xs">
              <div className="bg-muted/30 space-y-1 rounded-md p-3">
                <span className="text-foreground font-semibold">
                  {t("executiveSummaryLabel")}
                </span>
                <p className="text-muted-foreground whitespace-pre-line">
                  <AutoTranslate
                    text={
                      (viewSummary.officerEditedOutputJson || viewSummary.aiOutputJson)
                        ?.executiveSummary
                    }
                  />
                </p>
              </div>

              <div className="bg-muted/30 space-y-1 rounded-md p-3">
                <span className="text-foreground font-semibold">
                  {t("priorityExplanationLabel")}
                </span>
                <p className="text-muted-foreground whitespace-pre-line">
                  <AutoTranslate
                    text={
                      (viewSummary.officerEditedOutputJson || viewSummary.aiOutputJson)
                        ?.priorityExplanation
                    }
                  />
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
              {t("historyDialogTitle", { scope: tScope(activeScope) })}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("historyDialogDesc")}
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
                    {tStatus(h.status)}
                  </Badge>
                  <span className="text-muted-foreground">
                    <FormattedDate value={h.generatedAt} withTime />
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t("historyPromptScopeLine", {
                    prompt: h.promptVersion,
                    scope: tScope(h.summaryScope),
                  })}
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
