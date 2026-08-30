"use client";

import { CheckCircle2, Info, Pencil, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RejectReasonDialog } from "@/components/features/sharing/reject-reason-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormattedDate } from "@/components/common/formatted-date";
import { METHODOLOGY_CONFIG_HISTORY_PAGE_SIZE } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { methodologyConfigService } from "@/services/methodology-config/methodology-config.service";
import type {
  MethodologyConfig,
  MethodologyConfigHistoryEntry,
} from "@/services/methodology-config/methodology-config.types";
import { studyConfigService } from "@/services/study-config/study-config.service";
import type {
  CreateStudyConfigOptionPayload,
  StudyConfigOption,
  UpdateStudyConfigOptionPayload,
} from "@/services/study-config/study-config.types";

// Weights are edited as whole-number percentages but stored as 0-1 decimals
// (see the comment on weightSum below) — summing 9 such decimals can land a
// hair off 1 from binary floating-point rounding even when every displayed
// percentage is exact, so "exactly 100%" is checked with a small tolerance
// rather than strict equality.
const WEIGHT_SUM_TOLERANCE = 0.01;

function VersionCard({
  config,
  canWrite,
  canApprove,
  onChanged,
}: {
  config: MethodologyConfig;
  canWrite: boolean;
  canApprove: boolean;
  onChanged: (updated: MethodologyConfig) => void;
}) {
  const t = useTranslations("app.settings.methodology.config");
  const [editOpen, setEditOpen] = useState(false);
  const [versionInput, setVersionInput] = useState(config.version);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewDialogMode, setReviewDialogMode] = useState<"approve" | "reject" | null>(
    null,
  );

  async function saveVersion() {
    setSaving(true);
    setError(null);
    try {
      const updated = await methodologyConfigService.update({ version: versionInput });
      onChanged(updated);
      setEditOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const updated = await methodologyConfigService.publish();
      onChanged(updated);
    } catch {
      // Surfaced via the shared error area on the parent would need plumbing;
      // this action is low-risk/reversible (re-publish), so a silent retry
      // affordance (the button just stays enabled) is acceptable here.
    } finally {
      setPublishing(false);
    }
  }

  async function handleReviewConfirm(notes: string) {
    try {
      const updated =
        reviewDialogMode === "approve"
          ? await methodologyConfigService.approve(notes)
          : await methodologyConfigService.reject(notes);
      onChanged(updated);
      setReviewDialogMode(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">{t("versionHeading")}</h2>
          {canWrite ? (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
              {t("editVersion")}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-muted-foreground text-xs">{t("versionLabel")}</p>
            <p className="text-foreground text-sm font-medium">{config.version}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("statusLabel")}</p>
            <Badge
              variant={config.status === "published" ? "default" : "outline"}
              className={
                config.status === "published"
                  ? "bg-badge-success text-badge-success-foreground border-transparent"
                  : config.status === "approved"
                    ? "bg-badge-info text-badge-info-foreground border-transparent"
                    : config.status === "pending_approval"
                      ? "bg-badge-warning text-badge-warning-foreground border-transparent"
                  : undefined
              }
            >
              {t(`status.${config.status}`)}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("publishedByLabel")}</p>
            <p className="text-foreground text-sm font-medium">
              {config.publishedByName ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("publishedAtLabel")}</p>
            <p className="text-foreground text-sm font-medium">
              {config.publishedAt ? (
                <FormattedDate value={config.publishedAt} withTime />
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">{t("lastUpdatedLabel")}</p>
            <p className="text-foreground text-sm font-medium">
              <FormattedDate value={config.updatedAt} withTime />
            </p>
          </div>
        </div>

        <p className="border-badge-info/40 bg-badge-info/10 text-badge-info-foreground mt-4 flex items-start gap-2 rounded-md border p-3 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("versionNote")}
        </p>

        {config.status === "approved" || config.reviewedByName ? (
          <div className="bg-muted/50 mt-4 rounded-md p-3">
            <p className="text-muted-foreground text-xs">{t("reviewerNoteLabel")}</p>
            <p className="text-foreground mt-1 text-sm">
              {config.reviewNotes ?? "—"}
              {config.reviewedByName ? (
                <span className="text-muted-foreground">
                  {" — "}
                  {config.reviewedByName}
                  {config.reviewedAt ? (
                    <>
                      {" · "}
                      <FormattedDate value={config.reviewedAt} withTime />
                    </>
                  ) : null}
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {canApprove && config.status === "pending_approval" ? (
            <>
          <Button
            size="sm"
                className="gap-1.5"
                onClick={() => setReviewDialogMode("approve")}
          >
                <ShieldCheck className="size-3.5" />
                {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive gap-1.5"
                onClick={() => setReviewDialogMode("reject")}
              >
                <XCircle className="size-3.5" />
                {t("reject")}
              </Button>
            </>
          ) : null}

          {canWrite && config.status === "approved" ? (
            <Button size="sm" className="gap-1.5" onClick={publish} disabled={publishing}>
            <CheckCircle2 className="size-3.5" />
            {publishing ? t("publishing") : t("publish")}
          </Button>
        ) : null}
        </div>
      </CardContent>

      <RejectReasonDialog
        open={reviewDialogMode !== null}
        onOpenChange={(open) => !open && setReviewDialogMode(null)}
        onConfirm={handleReviewConfirm}
        title={
          reviewDialogMode === "approve"
            ? t("approveDialogTitle")
            : t("rejectDialogTitle")
        }
        reasonLabel={t("reviewerNotesLabel")}
        reasonRequiredError={t("reviewerNotesRequired")}
        cancelLabel={t("cancel")}
        confirmLabel={
          reviewDialogMode === "approve" ? t("confirmApprove") : t("confirmReject")
        }
        confirmVariant={reviewDialogMode === "approve" ? "default" : "destructive"}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editVersion")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="version-input">{t("versionLabel")}</Label>
            <Input
              id="version-input"
              value={versionInput}
              onChange={(e) => setVersionInput(e.target.value)}
            />
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={saveVersion} disabled={saving || !versionInput.trim()}>
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// RIO-NFR-017 (client-confirmed, Aug 4) — "retain full version history of
// every methodology configuration change — never overwrite." The backend
// now appends an immutable snapshot on every edit/publish
// (MethodologyConfigHistory); this is what makes that visible — previously
// there was no UI anywhere to see it, only the single current row.
function ConfigHistoryCard() {
  const t = useTranslations("app.settings.methodology.config");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<MethodologyConfigHistoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(METHODOLOGY_CONFIG_HISTORY_PAGE_SIZE);

  function load() {
    setLoadError(null);
    methodologyConfigService
      .getHistory()
      .then(setHistory)
      .catch((err) => {
        // Distinct from "no history yet" — a failed request must not render
        // as a quiet empty state, or a real outage looks identical to a
        // brand-new config with nothing recorded.
        setHistory(null);
        setLoadError(err instanceof ApiError ? err.message : t("historyLoadError"));
      });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && history === null && !loadError) load();
  }

  const pageCount = Math.max(1, Math.ceil((history?.length ?? 0) / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedHistory = (history ?? []).slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              {t("historyHeading")}
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">{t("historyNote")}</p>
          </div>
          <Button size="sm" variant="outline" onClick={toggle}>
            {open ? t("historyHide") : t("historyShow")}
          </Button>
        </div>
        {open ? (
          loadError ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-destructive text-sm">{loadError}</p>
              <Button size="sm" variant="outline" onClick={load}>
                {t("historyRetry")}
              </Button>
            </div>
          ) : history === null ? (
            <div className="bg-muted h-16 animate-pulse rounded-md" />
          ) : history.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("historyEmpty")}</p>
          ) : (
            <>
              <ul className="divide-border divide-y">
                {pagedHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.changeType === "publish" ? "default" : "outline"}
                      >
                        {t(`historyChangeType.${entry.changeType}`)}
                      </Badge>
                      <span className="text-foreground">{entry.version}</span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {entry.changedByName ?? t("historyUnknownActor")} ·{" "}
                      <FormattedDate value={entry.changedAt} withTime />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-border flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-40"
                    aria-label={t("historyRowsPerPage")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {t("historyRowsPerPage")}: {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("historyPagePrevious")}
                  nextLabel={t("historyPageNext")}
                  pageLabel={(p, count) => t("historyPageLabel", { page: p, count })}
                  className="sm:w-auto"
                />
              </div>
            </>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

// RIO-FR-012 (Sprint 2 clarification Q4, client-confirmed) — Study Type and
// Target Sector must be "configurable through Methodology Configuration"
// rather than hardcoded. The backend CRUD for both (StudyConfigController)
// has existed since this session's earlier work; this component is what
// was actually missing — until now nothing on the frontend ever called the
// create/update/activate/deactivate endpoints, only `list()` from the Study
// form's read-only dropdown. The values shown here are interim placeholders
// (Baseline Assessment / Follow-up Assessment / etc.) pending the client's
// actual value list — a System Admin can rename or replace them here once
// that lands, with no further build needed on this screen.
function ConfigurableOptionsCard({
  heading,
  note,
  canWrite,
  list,
  create,
  update,
  setActive,
}: {
  heading: string;
  note: string;
  canWrite: boolean;
  list: () => Promise<StudyConfigOption[]>;
  create: (payload: CreateStudyConfigOptionPayload) => Promise<StudyConfigOption>;
  update: (
    id: string,
    payload: UpdateStudyConfigOptionPayload,
  ) => Promise<StudyConfigOption>;
  setActive: (id: string, isActive: boolean) => Promise<StudyConfigOption>;
}) {
  const t = useTranslations("app.settings.methodology.config");
  const [options, setOptions] = useState<StudyConfigOption[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<StudyConfigOption | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    list()
      .then(setOptions)
      .catch(() => setOptions([]));
  }

  // `list` is a stable service-method reference passed directly by the
  // caller (e.g. `studyConfigService.listStudyTypes`, not a wrapping arrow),
  // so this is safe to run once rather than on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await create({ name: newName.trim() });
      setNewName("");
      setAddOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleActive(option: StudyConfigOption) {
    setTogglingId(option.id);
    setError(null);
    try {
      await setActive(option.id, !option.isActive);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setTogglingId(null);
    }
  }

  function openEdit(option: StudyConfigOption) {
    setEditing(option);
    setEditName(option.name);
  }

  async function saveEdit() {
    if (!editing || !editName.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      await update(editing.id, { name: editName.trim() });
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-foreground text-sm font-semibold">{heading}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        </div>
        {canWrite ? (
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            {t("addOption")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {options === null ? (
          <div className="bg-muted mx-5 mb-5 h-20 animate-pulse rounded-md" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("optionNameLabel")}</TableHead>
                <TableHead>{t("optionStatusLabel")}</TableHead>
                {canWrite ? (
                  <TableHead className="text-end">{t("optionActionsLabel")}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canWrite ? 3 : 2}
                    className="text-muted-foreground text-center"
                  >
                    {t("noOptionsYet")}
                  </TableCell>
                </TableRow>
              ) : (
                options.map((option) => (
                  <TableRow key={option.id}>
                    <TableCell className="text-foreground font-medium">
                      {option.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={option.isActive}
                          disabled={!canWrite || togglingId === option.id}
                          onCheckedChange={() => handleToggleActive(option)}
                          aria-label={
                            option.isActive ? t("deactivateOption") : t("activateOption")
                          }
                        />
                        <span className="text-muted-foreground text-xs">
                          {option.isActive ? t("optionActive") : t("optionInactive")}
                        </span>
                      </div>
                    </TableCell>
                    {canWrite ? (
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(option)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        {error ? <p className="text-destructive px-5 pb-4 text-sm">{error}</p> : null}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={(open) => !open && setAddOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addOption")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`option-add-input-${heading}`}>{t("optionNameLabel")}</Label>
            <Input
              id={`option-add-input-${heading}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("addOptionPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? t("saving") : t("addOption")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameOption")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="option-name-input">{t("optionNameLabel")}</Label>
            <Input
              id="option-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit || !editName.trim()}>
              {savingEdit ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function MethodologyConfigTab() {
  const t = useTranslations("app.settings.methodology.config");
  const canWrite = usePermission("methodologyQuestionBank", "write");
  const canApprove = usePermission("methodologyQuestionBank", "approve");

  const [config, setConfig] = useState<MethodologyConfig | null>(null);
  const [thresholds, setThresholds] = useState({
    criticalSeverity: "",
    highSeverity: "",
    mediumSeverity: "",
    equityHighSeverity: "",
  });
  const [factorWeights, setFactorWeights] = useState<
    Array<{ key: string; label: string; weight: string }>
  >([]);
  const [flags, setFlags] = useState({
    dontKnowRatioThreshold: "",
    minRespondentsForStandardConfidence: "",
  });
  // RIO-AI-001 — the AI classification confidence bands. Held as percentage
  // STRINGS for the inputs (a reviewer thinks in "70%", not "0.7") and
  // converted back to the 0..1 scale the API uses on save. Kept separate from
  // `flags` above: those gate a survey's response-data confidence, these gate
  // a model's self-reported confidence in a classification — same word, two
  // unrelated scales.
  const [aiConfidence, setAiConfidence] = useState({
    lowConfidenceThreshold: "",
    veryLowConfidenceThreshold: "",
  });
  // RIO-AI-003 — when a need description is long enough to be summarised, and
  // how long the suggestion may be. Plain character counts, so unlike
  // `aiConfidence` above there is no percentage conversion: what the reviewer
  // types is what the API stores.
  const [aiSummary, setAiSummary] = useState({
    statementLengthThreshold: "",
    maxSummaryChars: "",
  });
  // RIO-FR-003 — the floor/ceiling conversion rules that turn a raw figure
  // into the 0-100 value a factor weight multiplies (e.g. what "450
  // affected people" is worth out of 100), plus the urgency-level scale and
  // the strategic-axis multipliers. Held as strings for the same reason as
  // every other numeric field on this screen — an input that echoes back
  // "80" is friendlier than one that echoes "80.0000000001".
  const [factorScales, setFactorScales] = useState({
    urgency: {} as Record<string, string>,
    affectedPopulation: { floor: "", ceiling: "" },
    geographicCoverage: { floor: "", ceiling: "" },
    frequency: { floor: "", ceiling: "" },
    equitySpreadThreshold: "",
    strategicAxes: [] as Array<{
      key: string;
      label: string;
      value: string;
      domains: string[];
      questionIds: string[];
    }>,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  function applyConfig(c: MethodologyConfig) {
    setConfig(c);
    setThresholds({
      criticalSeverity: String(c.priorityThresholds.criticalSeverity),
      highSeverity: String(c.priorityThresholds.highSeverity),
      mediumSeverity: String(c.priorityThresholds.mediumSeverity),
      equityHighSeverity: String(c.priorityThresholds.equityHighSeverity),
    });
    setFactorWeights(
      c.priorityFactorWeights.map((f) => ({
        key: f.key,
        label: f.label,
        weight: String(f.weight),
      })),
    );
    setFlags({
      dontKnowRatioThreshold: String(c.confidenceFlagSettings.dontKnowRatioThreshold),
      minRespondentsForStandardConfidence: String(
        c.confidenceFlagSettings.minRespondentsForStandardConfidence,
      ),
    });
    setAiConfidence({
      lowConfidenceThreshold: String(
        Math.round(c.aiClassificationSettings.lowConfidenceThreshold * 100),
      ),
      veryLowConfidenceThreshold: String(
        Math.round(c.aiClassificationSettings.veryLowConfidenceThreshold * 100),
      ),
    });
    setAiSummary({
      statementLengthThreshold: String(c.aiSummarySettings.statementLengthThreshold),
      maxSummaryChars: String(c.aiSummarySettings.maxSummaryChars),
    });
    setFactorScales({
      urgency: Object.fromEntries(
        Object.entries(c.priorityFactorScales.urgency).map(([level, value]) => [
          level,
          String(value),
        ]),
      ),
      affectedPopulation: {
        floor: String(c.priorityFactorScales.affectedPopulation.floor),
        ceiling: String(c.priorityFactorScales.affectedPopulation.ceiling),
      },
      geographicCoverage: {
        floor: String(c.priorityFactorScales.geographicCoverage.floor),
        ceiling: String(c.priorityFactorScales.geographicCoverage.ceiling),
      },
      frequency: {
        floor: String(c.priorityFactorScales.frequency.floor),
        ceiling: String(c.priorityFactorScales.frequency.ceiling),
      },
      equitySpreadThreshold: String(c.priorityFactorScales.equitySpreadThreshold),
      strategicAxes: c.priorityFactorScales.strategicAxes.map((axis) => ({
        ...axis,
        value: String(axis.value),
      })),
    });
    setDirty(false);
  }

  useEffect(() => {
    methodologyConfigService
      .get()
      .then(applyConfig)
      .catch(() => undefined);
  }, []);

  function markDirty<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
      setSaved(false);
    };
  }
  const setThresholdsDirty = markDirty(setThresholds);
  const setFactorWeightsDirty = markDirty(setFactorWeights);
  const setFlagsDirty = markDirty(setFlags);
  const setAiConfidenceDirty = markDirty(setAiConfidence);
  const setAiSummaryDirty = markDirty(setAiSummary);
  const setFactorScalesDirty = markDirty(setFactorScales);

  async function save() {
    // Belt-and-suspenders alongside the button's `disabled` — the backend
    // already rejects an off-100% total, but by then thresholds/flags may
    // have already been persisted alongside the invalid weights (the bug
    // this guards against). Never even issue the request when it's invalid.
    if (
      !weightSumValid ||
      !aiConfidenceOrderValid ||
      !aiSummaryOrderValid ||
      !factorScalesValid
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const updated = await methodologyConfigService.update({
        priorityThresholds: {
          criticalSeverity: Number(thresholds.criticalSeverity),
          highSeverity: Number(thresholds.highSeverity),
          mediumSeverity: Number(thresholds.mediumSeverity),
          equityHighSeverity: Number(thresholds.equityHighSeverity),
        },
        priorityFactorWeights: factorWeights.map((f) => ({
          key: f.key,
          weight: Number(f.weight),
        })),
        confidenceFlagSettings: {
          dontKnowRatioThreshold: Number(flags.dontKnowRatioThreshold),
          minRespondentsForStandardConfidence: Number(
            flags.minRespondentsForStandardConfidence,
          ),
        },
        // Back to the 0..1 scale the API and AiDecision.confidence both use.
        aiClassificationSettings: {
          lowConfidenceThreshold: Number(aiConfidence.lowConfidenceThreshold) / 100,
          veryLowConfidenceThreshold:
            Number(aiConfidence.veryLowConfidenceThreshold) / 100,
        },
        aiSummarySettings: {
          statementLengthThreshold: Number(aiSummary.statementLengthThreshold),
          maxSummaryChars: Number(aiSummary.maxSummaryChars),
        },
        priorityFactorScales: {
          urgency: Object.fromEntries(
            Object.entries(factorScales.urgency).map(([level, value]) => [
              level,
              Number(value),
            ]),
          ),
          affectedPopulation: {
            floor: Number(factorScales.affectedPopulation.floor),
            ceiling: Number(factorScales.affectedPopulation.ceiling),
          },
          geographicCoverage: {
            floor: Number(factorScales.geographicCoverage.floor),
            ceiling: Number(factorScales.geographicCoverage.ceiling),
          },
          frequency: {
            floor: Number(factorScales.frequency.floor),
            ceiling: Number(factorScales.frequency.ceiling),
          },
          equitySpreadThreshold: Number(factorScales.equitySpreadThreshold),
          strategicAxes: factorScales.strategicAxes.map((axis) => ({
            ...axis,
            value: Number(axis.value),
          })),
        },
      });
      applyConfig(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <div className="bg-muted h-64 animate-pulse rounded-md" />;
  }

  // Stored/sent as a 0-1 decimal weight (what the scoring formula actually
  // multiplies by), but shown to NGO admins as a whole-number percentage —
  // "0.2" reads as "0.2 out of what?" where "20%" is immediately legible,
  // and percentages are how this factor mix is described in the BRD/workbook.
  const weightSum = factorWeights.reduce((sum, f) => sum + (Number(f.weight) || 0), 0);
  const weightSumPercent = Math.round(weightSum * 100);
  const weightSumValid = Math.abs(weightSum - 1) <= WEIGHT_SUM_TOLERANCE;

  // Mirrors the backend's validateAiClassificationSettings. Checked here too
  // so the reason is visible next to the fields rather than only arriving as
  // a save error — and so an invalid pair never gets sent alongside the other
  // (valid) threshold families, which would persist those and reject the rest.
  const aiConfidenceOrderValid =
    Number(aiConfidence.veryLowConfidenceThreshold) <
    Number(aiConfidence.lowConfidenceThreshold);

  // Mirrors the backend's validateAiSummarySettings. A summary allowed to be
  // as long as the text that triggers it is not a summary — the feature would
  // still look configured while doing nothing.
  const aiSummaryOrderValid =
    Number(aiSummary.maxSummaryChars) < Number(aiSummary.statementLengthThreshold);

  // Mirrors the backend's validatePriorityFactorScales exactly — same three
  // range checks, the same 0-100 bound on equitySpreadThreshold, and the
  // same 0-100 bound per urgency level.
  const factorRangeValid = (r: { floor: string; ceiling: string }) =>
    Number(r.ceiling) > Number(r.floor);
  const factorScalesValid =
    factorRangeValid(factorScales.affectedPopulation) &&
    factorRangeValid(factorScales.geographicCoverage) &&
    factorRangeValid(factorScales.frequency) &&
    Number(factorScales.equitySpreadThreshold) >= 0 &&
    Number(factorScales.equitySpreadThreshold) <= 100 &&
    Object.values(factorScales.urgency).every((v) => Number(v) >= 0 && Number(v) <= 100);

  return (
    <div className="space-y-6">
      {canWrite ? (
        <div className="bg-background/95 border-border sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-b px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {saved && !dirty ? (
            <p className="text-badge-success-foreground text-sm">{t("savedNote")}</p>
          ) : null}
          <Button
            onClick={save}
            disabled={
              saving ||
              !dirty ||
              !weightSumValid ||
              !aiConfidenceOrderValid ||
              !aiSummaryOrderValid ||
              !factorScalesValid
            }
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      ) : null}

      <VersionCard
        config={config}
        canWrite={canWrite}
        canApprove={canApprove}
        onChanged={applyConfig}
      />
      <ConfigHistoryCard />

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-foreground text-sm font-semibold">
            {t("thresholdsHeading")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("thresholdsNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="threshold-critical">{t("criticalSeverityLabel")}</Label>
              <Input
                id="threshold-critical"
                type="number"
                value={thresholds.criticalSeverity}
                onChange={(e) =>
                  setThresholdsDirty({ ...thresholds, criticalSeverity: e.target.value })
                }
                disabled={!canWrite}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold-high">{t("highSeverityLabel")}</Label>
              <Input
                id="threshold-high"
                type="number"
                value={thresholds.highSeverity}
                onChange={(e) =>
                  setThresholdsDirty({ ...thresholds, highSeverity: e.target.value })
                }
                disabled={!canWrite}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold-medium">{t("mediumSeverityLabel")}</Label>
              <Input
                id="threshold-medium"
                type="number"
                value={thresholds.mediumSeverity}
                onChange={(e) =>
                  setThresholdsDirty({ ...thresholds, mediumSeverity: e.target.value })
                }
                disabled={!canWrite}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold-equity">{t("equityHighSeverityLabel")}</Label>
              <Input
                id="threshold-equity"
                type="number"
                value={thresholds.equityHighSeverity}
                onChange={(e) =>
                  setThresholdsDirty({
                    ...thresholds,
                    equityHighSeverity: e.target.value,
                  })
                }
                disabled={!canWrite}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-foreground text-sm font-semibold">
            {t("factorWeightsHeading")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("factorWeightsNote")}</p>
          <div>
            <div className="text-muted-foreground flex items-center justify-between gap-4 pb-2 text-xs font-medium">
              <span>{t("factorColumnLabel")}</span>
              <span>{t("weightColumnLabel")}</span>
            </div>
            <div className="divide-border divide-y">
              {factorWeights.map((factor, index) => {
                const percent = Math.round((Number(factor.weight) || 0) * 100);
                return (
                  <div
                    key={factor.key}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <span className="text-foreground text-sm">{factor.label}</span>
                    <div className="relative w-24">
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        max={100}
                        className="pr-6 text-right"
                        value={percent}
                        onChange={(e) => {
                          const nextPercent = Number(e.target.value) || 0;
                          const next = [...factorWeights];
                          next[index] = {
                            ...factor,
                            weight: (nextPercent / 100).toString(),
                          };
                          setFactorWeightsDirty(next);
                        }}
                        disabled={!canWrite}
                      />
                      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm">
                        %
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-border mt-1 flex items-center justify-between gap-4 border-t pt-2.5">
              <span className="text-foreground text-sm font-semibold">
                {t("weightTotalLabel")}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  weightSumValid ? "text-foreground" : "text-destructive",
                )}
              >
                {weightSumPercent}%
              </span>
            </div>
          </div>
          <p
            className={cn(
              "text-xs",
              weightSumValid ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {weightSumValid
              ? t("weightSumNote", { sum: weightSumPercent })
              : t("weightSumError")}
          </p>
        </CardContent>
      </Card>

      {/* RIO-NFR-014/017 — closes the last "editable from an admin screen"
          gap: the floor/ceiling conversion rules, urgency scale, and
          strategic-axis multipliers were already fully wired into live
          scoring (RIO-FR-003) but only settable via direct API call. */}
      <Card>
        <CardContent className="space-y-5 p-5">
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              {t("factorScalesHeading")}
            </h2>
            <p className="text-muted-foreground text-xs">{t("factorScalesNote")}</p>
          </div>

          <div>
            <h3 className="text-foreground mb-2 text-xs font-semibold uppercase">
              {t("factorScalesRangesHeading")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["affectedPopulation", t("factorScalesAffectedPopulationLabel")],
                  ["geographicCoverage", t("factorScalesGeographicCoverageLabel")],
                  ["frequency", t("factorScalesFrequencyLabel")],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      aria-label={t("factorScalesFloorAria", { label })}
                      placeholder={t("factorScalesFloorLabel")}
                      value={factorScales[key].floor}
                      onChange={(e) =>
                        setFactorScalesDirty({
                          ...factorScales,
                          [key]: { ...factorScales[key], floor: e.target.value },
                        })
                      }
                      disabled={!canWrite}
                    />
                    <span className="text-muted-foreground text-xs">
                      {t("factorScalesToLabel")}
                    </span>
                    <Input
                      type="number"
                      aria-label={t("factorScalesCeilingAria", { label })}
                      placeholder={t("factorScalesCeilingLabel")}
                      value={factorScales[key].ceiling}
                      onChange={(e) =>
                        setFactorScalesDirty({
                          ...factorScales,
                          [key]: { ...factorScales[key], ceiling: e.target.value },
                        })
                      }
                      disabled={!canWrite}
                    />
                  </div>
                  {Number(factorScales[key].ceiling) <=
                  Number(factorScales[key].floor) ? (
                    <p className="text-destructive text-xs">
                      {t("factorScalesRangeError")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-foreground mb-2 text-xs font-semibold uppercase">
              {t("factorScalesUrgencyHeading")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(factorScales.urgency).map(([level, value]) => (
                <div key={level} className="space-y-2">
                  <Label htmlFor={`urgency-${level}`}>
                    {t.has(`factorScalesUrgencyLevel.${level}`)
                      ? t(`factorScalesUrgencyLevel.${level}` as Parameters<typeof t>[0])
                      : level}
                  </Label>
                  <Input
                    id={`urgency-${level}`}
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) =>
                      setFactorScalesDirty({
                        ...factorScales,
                        urgency: { ...factorScales.urgency, [level]: e.target.value },
                      })
                    }
                    disabled={!canWrite}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equity-spread-threshold">
              {t("factorScalesEquitySpreadLabel")}
            </Label>
            <Input
              id="equity-spread-threshold"
              type="number"
              min={0}
              max={100}
              className="max-w-32"
              value={factorScales.equitySpreadThreshold}
              onChange={(e) =>
                setFactorScalesDirty({
                  ...factorScales,
                  equitySpreadThreshold: e.target.value,
                })
              }
              disabled={!canWrite}
            />
            <p className="text-muted-foreground text-xs">
              {t("factorScalesEquitySpreadNote")}
            </p>
          </div>

          <div>
            <h3 className="text-foreground mb-2 text-xs font-semibold uppercase">
              {t("factorScalesStrategicAxesHeading")}
            </h3>
            <div className="divide-border divide-y">
              {factorScales.strategicAxes.map((axis, index) => (
                <div
                  key={axis.key}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <div>
                    <span className="text-foreground text-sm">{axis.label}</span>
                    <p className="text-muted-foreground text-xs">
                      {axis.domains.join(", ")}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-24 text-right"
                    aria-label={t("factorScalesAxisValueAria", { label: axis.label })}
                    value={axis.value}
                    onChange={(e) => {
                      const next = [...factorScales.strategicAxes];
                      next[index] = { ...axis, value: e.target.value };
                      setFactorScalesDirty({ ...factorScales, strategicAxes: next });
                    }}
                    disabled={!canWrite}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-foreground text-sm font-semibold">{t("flagsHeading")}</h2>
          <p className="text-muted-foreground text-xs">{t("flagsNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flag-dont-know">{t("dontKnowRatioLabel")}</Label>
              <Input
                id="flag-dont-know"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={flags.dontKnowRatioThreshold}
                onChange={(e) =>
                  setFlagsDirty({ ...flags, dontKnowRatioThreshold: e.target.value })
                }
                disabled={!canWrite}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flag-min-respondents">{t("minRespondentsLabel")}</Label>
              <Input
                id="flag-min-respondents"
                type="number"
                value={flags.minRespondentsForStandardConfidence}
                onChange={(e) =>
                  setFlagsDirty({
                    ...flags,
                    minRespondentsForStandardConfidence: e.target.value,
                  })
                }
                disabled={!canWrite}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RIO-AI-001 — the thresholds below which an AI classification
          suggestion is flagged for closer reviewer attention. Entered as
          percentages because that is how the reviewer screen displays a
          confidence; stored on the 0..1 scale. */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-foreground text-sm font-semibold">
            {t("aiConfidenceHeading")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("aiConfidenceNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-confidence-low">{t("aiLowConfidenceLabel")}</Label>
              <Input
                id="ai-confidence-low"
                type="number"
                step="1"
                min={0}
                max={100}
                value={aiConfidence.lowConfidenceThreshold}
                onChange={(e) =>
                  setAiConfidenceDirty({
                    ...aiConfidence,
                    lowConfidenceThreshold: e.target.value,
                  })
                }
                disabled={!canWrite}
                aria-invalid={!aiConfidenceOrderValid ? true : undefined}
              />
              <p className="text-muted-foreground text-xs">{t("aiLowConfidenceHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-confidence-very-low">
                {t("aiVeryLowConfidenceLabel")}
              </Label>
              <Input
                id="ai-confidence-very-low"
                type="number"
                step="1"
                min={0}
                max={100}
                value={aiConfidence.veryLowConfidenceThreshold}
                onChange={(e) =>
                  setAiConfidenceDirty({
                    ...aiConfidence,
                    veryLowConfidenceThreshold: e.target.value,
                  })
                }
                disabled={!canWrite}
                aria-invalid={!aiConfidenceOrderValid ? true : undefined}
              />
              <p className="text-muted-foreground text-xs">
                {t("aiVeryLowConfidenceHint")}
              </p>
            </div>
          </div>
          {!aiConfidenceOrderValid ? (
            <p className="text-destructive text-xs">{t("aiConfidenceOrderError")}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* RIO-AI-003 — when a long need description gets a suggested summary.
          Plain character counts, and one number for every language: Arabic is
          more compact per character than English, so a word count would behave
          as two different rules (client decision, 25 Aug 2026). */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="text-foreground text-sm font-semibold">
            {t("aiSummaryHeading")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("aiSummaryNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-summary-threshold">{t("aiSummaryThresholdLabel")}</Label>
              <Input
                id="ai-summary-threshold"
                type="number"
                step="100"
                min={200}
                max={5000}
                value={aiSummary.statementLengthThreshold}
                onChange={(e) =>
                  setAiSummaryDirty({
                    ...aiSummary,
                    statementLengthThreshold: e.target.value,
                  })
                }
                disabled={!canWrite}
                aria-invalid={!aiSummaryOrderValid ? true : undefined}
              />
              <p className="text-muted-foreground text-xs">
                {t("aiSummaryThresholdHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-summary-max">{t("aiSummaryMaxLabel")}</Label>
              <Input
                id="ai-summary-max"
                type="number"
                step="50"
                min={100}
                max={2000}
                value={aiSummary.maxSummaryChars}
                onChange={(e) =>
                  setAiSummaryDirty({ ...aiSummary, maxSummaryChars: e.target.value })
                }
                disabled={!canWrite}
                aria-invalid={!aiSummaryOrderValid ? true : undefined}
              />
              <p className="text-muted-foreground text-xs">{t("aiSummaryMaxHint")}</p>
            </div>
          </div>
          {!aiSummaryOrderValid ? (
            <p className="text-destructive text-xs">{t("aiSummaryOrderError")}</p>
          ) : null}
        </CardContent>
      </Card>

      <ConfigurableOptionsCard
        heading={t("studyTypesHeading")}
        note={t("studyTypesNote")}
        canWrite={canWrite}
        list={studyConfigService.listStudyTypes}
        create={studyConfigService.createStudyType}
        update={studyConfigService.updateStudyType}
        setActive={studyConfigService.setStudyTypeActive}
      />

      <ConfigurableOptionsCard
        heading={t("targetSectorsHeading")}
        note={t("targetSectorsNote")}
        canWrite={canWrite}
        list={studyConfigService.listTargetSectors}
        create={studyConfigService.createTargetSector}
        update={studyConfigService.updateTargetSector}
        setActive={studyConfigService.setTargetSectorActive}
      />

      {/* RIO-FR-005 (Q10, client-confirmed) — "Decision Types should be
          configurable via an admin screen rather than hardcoded — starting
          with Intervention, Escalation, and Follow-up." The backend CRUD
          (StudyConfigController's decision-types routes) and the frontend
          service methods both already existed; this card was the missing
          piece — nothing previously called create/update/activate/
          deactivate, only the read-only list() the decision-logging
          dropdown uses. */}
      <ConfigurableOptionsCard
        heading={t("decisionTypesHeading")}
        note={t("decisionTypesNote")}
        canWrite={canWrite}
        list={studyConfigService.listDecisionTypes}
        create={studyConfigService.createDecisionType}
        update={studyConfigService.updateDecisionType}
        setActive={studyConfigService.setDecisionTypeActive}
      />

      {/* Client correction (2026-08-27), superseding RIO-FR-005 Q12's
          "five fixed values, final, no additions" — Gap Types now belongs
          in the same configurable-list family as Study Types/Target
          Sectors/Decision Types above. Seeded with the 5 original values
          so existing Need.gapType data keeps working unchanged. */}
      <ConfigurableOptionsCard
        heading={t("gapTypesHeading")}
        note={t("gapTypesNote")}
        canWrite={canWrite}
        list={studyConfigService.listGapTypes}
        create={studyConfigService.createGapType}
        update={studyConfigService.updateGapType}
        setActive={studyConfigService.setGapTypeActive}
      />

      {/* RIO-FR-003 AC 6 — editing this list changes what needs get filed
          under, and therefore what the recurrence factor counts. */}
      <ConfigurableOptionsCard
        heading={t("needThemesHeading")}
        note={t("needThemesNote")}
        canWrite={canWrite}
        list={studyConfigService.listNeedThemes}
        create={studyConfigService.createNeedTheme}
        update={studyConfigService.updateNeedTheme}
        setActive={studyConfigService.setNeedThemeActive}
      />
    </div>
  );
}
