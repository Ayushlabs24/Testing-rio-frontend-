"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/common/loading-button";
import { ApiError } from "@/services/api/types";
import { needDecisionsService } from "@/services/need-decisions/need-decisions.service";
import type {
  DecisionStatus,
  NeedDecision,
} from "@/services/need-decisions/need-decisions.types";
import { studyConfigService } from "@/services/study-config/study-config.service";
import type { StudyConfigOption } from "@/services/study-config/study-config.types";

const STATUS_OPTIONS: DecisionStatus[] = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
];
const TERMINAL: DecisionStatus[] = ["completed", "cancelled"];

interface NeedDecisionsPanelProps {
  needId: string;
  /** priorityScoring:create — the same gate Recalculate/Quality Assessment
   * use on this page. Read-only rendering when false. */
  canManage: boolean;
}

export function NeedDecisionsPanel({ needId, canManage }: NeedDecisionsPanelProps) {
  const t = useTranslations("PriorityDashboard.decisions");
  const locale = useLocale() as AppLocale;
  const [decisions, setDecisions] = useState<NeedDecision[] | null>(null);
  const [decisionTypes, setDecisionTypes] = useState<StudyConfigOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [decisionType, setDecisionType] = useState("");
  const [responsibleParty, setResponsibleParty] = useState("");
  const [decisionDate, setDecisionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  function load() {
    Promise.all([
      needDecisionsService.list(needId),
      studyConfigService.listDecisionTypes(),
    ])
      .then(([d, types]) => {
        setDecisions(d);
        setDecisionTypes(types.filter((o) => o.isActive));
      })
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : t("loadError")),
      );
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId]);

  async function handleCreate() {
    if (!decisionType || !responsibleParty.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await needDecisionsService.create(needId, {
        decisionType,
        responsibleParty: responsibleParty.trim(),
        decisionDate,
        notes: notes.trim() || undefined,
      });
      setCreateOpen(false);
      setDecisionType("");
      setResponsibleParty("");
      setDecisionDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      load();
    } catch (err) {
      // NO_APPROVED_PRIORITY_SCORE (Q34) is the one refusal this dialog
      // needs to explain — everything else falls back to the raw message.
      setFormError(
        err instanceof ApiError && err.code === "NO_APPROVED_PRIORITY_SCORE"
          ? t("noApprovedScoreError")
          : err instanceof ApiError
            ? err.message
            : t("genericError"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(decisionId: string, status: DecisionStatus) {
    try {
      await needDecisionsService.updateStatus(needId, decisionId, { status });
      load();
    } catch {
      setLoadError(t("statusUpdateError"));
    }
  }

  function statusBadgeVariant(
    status: DecisionStatus,
  ): "default" | "outline" | "secondary" {
    if (status === "completed") return "default";
    if (status === "cancelled") return "outline";
    return "secondary";
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-foreground text-sm font-semibold">{t("title")}</p>
            <p className="text-muted-foreground text-xs">{t("subtitle")}</p>
          </div>
          {canManage ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">{t("logDecision")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("logDecision")}</DialogTitle>
                  <DialogDescription>{t("dialogDescription")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t("decisionTypeLabel")}</Label>
                    <Select value={decisionType} onValueChange={setDecisionType}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("decisionTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {decisionTypes.map((option) => (
                          <SelectItem key={option.id} value={option.name}>
                            {localizedName(option, locale)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="decision-responsible-party">
                      {t("responsiblePartyLabel")}
                    </Label>
                    <Input
                      id="decision-responsible-party"
                      value={responsibleParty}
                      onChange={(e) => setResponsibleParty(e.target.value)}
                      placeholder={t("responsiblePartyPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="decision-date">{t("decisionDateLabel")}</Label>
                    <Input
                      id="decision-date"
                      type="date"
                      value={decisionDate}
                      onChange={(e) => setDecisionDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="decision-notes">{t("notesLabel")}</Label>
                    <Textarea
                      id="decision-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  {formError ? (
                    <p role="alert" className="text-destructive text-sm">
                      {formError}
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={saving}
                  >
                    {t("cancel")}
                  </Button>
                  <LoadingButton
                    type="button"
                    onClick={handleCreate}
                    disabled={!decisionType || !responsibleParty.trim() || !decisionDate}
                    isLoading={saving}
                    text={saving ? t("saving") : t("save")}
                  />
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        {loadError ? <p className="text-destructive text-sm">{loadError}</p> : null}

        {decisions === null ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <span className="sr-only">{t("loading")}</span>
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="bg-muted h-4 w-40 animate-pulse rounded" />
                <div className="bg-muted h-3 w-56 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noDecisions")}</p>
        ) : (
          <ul className="space-y-3">
            {decisions.map((decision) => (
              <li key={decision.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {(() => {
                        const option = decisionTypes.find(
                          (o) => o.name === decision.decisionType,
                        );
                        return option
                          ? localizedName(option, locale)
                          : decision.decisionType;
                      })()}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("responsiblePartyLabel")}: {decision.responsibleParty}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("decisionDateLabel")}: {decision.decisionDate}
                    </p>
                  </div>
                  {canManage && !TERMINAL.includes(decision.status) ? (
                    <Select
                      value={decision.status}
                      onValueChange={(value) =>
                        handleStatusChange(decision.id, value as DecisionStatus)
                      }
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={statusBadgeVariant(decision.status)}>
                      {t(`status.${decision.status}`)}
                    </Badge>
                  )}
                </div>
                {decision.notes ? (
                  <p className="text-muted-foreground mt-2 text-sm">{decision.notes}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedHistoryId((current) =>
                      current === decision.id ? null : decision.id,
                    )
                  }
                  className="text-muted-foreground hover:text-foreground mt-2 cursor-pointer text-xs underline underline-offset-2"
                >
                  {expandedHistoryId === decision.id
                    ? t("hideHistory")
                    : t("showHistory", { count: decision.history.length })}
                </button>
                {expandedHistoryId === decision.id ? (
                  <ul className="border-border mt-2 space-y-1.5 border-t pt-2">
                    {decision.history.map((event) => (
                      <li key={event.id} className="text-muted-foreground text-xs">
                        <span className="tabular-nums">
                          {new Date(event.changedAt).toLocaleString()}
                        </span>
                        {" — "}
                        {event.fromStatus
                          ? t("historyTransition", {
                              from: t(`status.${event.fromStatus}`),
                              to: t(`status.${event.toStatus}`),
                            })
                          : t("historyCreated", { to: t(`status.${event.toStatus}`) })}
                        {event.note ? ` (${event.note})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
