"use client";

import { AlertTriangle, CheckCircle2, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { useAutoTranslate } from "@/hooks/use-auto-translate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/common/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { priorityService } from "@/services/priority/priority.service";
import type { PriorityScore } from "@/services/priority/priority.types";

/**
 * RIO-FR-003 AC 2 — "all score components are individually visible to the
 * reviewer, not just the final number".
 *
 * Every configured factor gets a row, including the ones with no evidence. A
 * factor the reviewer cannot see is a factor they cannot argue with, and the
 * whole point of the ticket is replacing ad-hoc judgement with something
 * transparent enough to disagree with.
 *
 * Unmeasured factors show "Not measured" rather than 0. That distinction is
 * load-bearing: 0 asserts we looked and found nothing, which for an unset
 * urgency is simply false, and it would also drag the score down for a need
 * whose only failing is an empty field.
 */
export function PriorityBreakdown({
  score,
  onScoreUpdated,
}: {
  score: PriorityScore;
  onScoreUpdated: (next: PriorityScore) => void;
}) {
  const t = useTranslations("app.priorityDashboard.breakdown");
  const canOverride = usePermission("priorityScoring", "approve");

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(score.effectiveScore));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breakdown = score.factors;
  // Interpolated into a translation string below (modelNote), so this needs
  // the plain-string hook, not the <AutoTranslate> component — same raw
  // English methodology-version-name bug already fixed on the Data Quality
  // panel and Survey Builder's own version dropdown, missed here.
  const translatedMethodologyVersion = useAutoTranslate(
    breakdown?.methodologyVersion ?? null,
  ).text;
  const components = breakdown?.components ?? [];
  const coveragePct = Math.round((breakdown?.coverage ?? 0) * 100);
  const isOverridden = score.overrideScore !== null;
  const parsed = Number(value);
  const valueValid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;

  async function submitOverride() {
    setSaving(true);
    setError(null);
    try {
      onScoreUpdated(await priorityService.override(score.id, parsed, reason));
      setOpen(false);
      setReason("");
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  // Sign off on the computed score as-is — distinct from Override above,
  // which changes the number. Previously missing entirely: the backend
  // endpoint and this service call both existed, but nothing in the UI
  // ever triggered it, so a reviewer with genuine approve permission had
  // no way to actually approve a score, only to override one.
  async function submitApprove() {
    setApproving(true);
    setError(null);
    try {
      onScoreUpdated(await priorityService.approve(score.id));
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setApproving(false);
    }
  }

  return (
    <section
      className="border-border bg-card space-y-4 rounded-lg border p-5"
      aria-labelledby="priority-breakdown-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="priority-breakdown-heading"
            className="text-foreground text-sm font-semibold"
          >
            {t("heading")}
          </h2>
          <p className="text-muted-foreground text-xs">
            {t("modelNote", {
              version: breakdown?.methodologyVersion
                ? translatedMethodologyVersion
                : t("noVersion"),
            })}
          </p>
        </div>

        <div className="text-right">
          <p className="text-foreground text-3xl font-semibold tabular-nums">
            {score.effectiveScore.toFixed(1)}
          </p>
          {/* AC 5 — the computed value stays visible next to the override, so
              the two are distinguishable at a glance and not just in the API. */}
          {isOverridden ? (
            <p className="text-badge-warning-foreground text-xs">
              {t("computedWas", { value: score.computedScore.toFixed(1) })}
            </p>
          ) : null}
        </div>
      </div>

      {/* Coverage, stated plainly. A score built on half the factors must never
          be mistaken for a complete one. */}
      {coveragePct < 100 ? (
        <p className="border-badge-warning/40 bg-badge-warning/10 text-badge-warning-foreground flex items-start gap-2 rounded-md border p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("partialCoverage", { percent: coveragePct })}
        </p>
      ) : null}

      {isOverridden ? (
        <div className="border-badge-warning/40 bg-badge-warning/10 space-y-1 rounded-md border p-3">
          <p className="text-badge-warning-foreground flex items-center gap-2 text-xs font-medium">
            <PencilLine className="size-3.5" aria-hidden />
            {t("overriddenHeading")}
          </p>
          <p className="text-muted-foreground text-xs">
            <AutoTranslate text={score.overrideReason} />
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="text-muted-foreground border-border border-b text-left text-xs">
              <th className="w-[38%] py-2 font-medium">{t("colFactor")}</th>
              <th className="w-[14%] py-2 text-right font-medium">{t("colWeight")}</th>
              <th className="w-[16%] py-2 text-right font-medium">{t("colValue")}</th>
              <th className="w-[20%] py-2 text-right font-medium">
                {t("colContribution")}
              </th>
            </tr>
          </thead>
          <tbody>
            {components.map((c) => (
              <tr
                key={c.key}
                className="border-rule border-border/60 border-b last:border-0"
              >
                <td className="py-2.5 align-top break-words whitespace-normal">
                  <span className="text-foreground">
                    {t.has(`factorLabels.${c.key}`)
                      ? t(`factorLabels.${c.key}` as Parameters<typeof t>[0])
                      : c.label}
                  </span>
                  {c.basis ? (
                    <span className="text-muted-foreground block text-xs">
                      <AutoTranslate text={c.basis} />
                    </span>
                  ) : null}
                </td>
                <td className="text-muted-foreground py-2.5 text-right align-top tabular-nums">
                  {Math.round(c.weight * 100)}%
                </td>
                <td className="py-2.5 text-right align-top tabular-nums">
                  {c.value === null ? (
                    <span className="text-muted-foreground text-xs">
                      {t("notMeasured")}
                    </span>
                  ) : (
                    c.value.toFixed(1)
                  )}
                </td>
                <td className="text-muted-foreground py-2.5 text-right align-top tabular-nums">
                  {c.contribution === null ? "—" : c.contribution.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {score.isApproved ? (
          <Badge
            variant="outline"
            className="border-badge-success/40 bg-badge-success/10 text-badge-success-foreground"
          >
            <CheckCircle2 className="size-3" aria-hidden /> {t("approved")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("awaitingSignOff")}</Badge>
        )}

        {/* AC 5. Gated on approve rather than write: overruling the engine is
            a decision about the number, not a run of it. */}
        {canOverride && !score.isApproved ? (
          <>
            <LoadingButton
              onClick={submitApprove}
              isLoading={approving}
              disabled={saving}
              startIcon={<CheckCircle2 className="size-4" aria-hidden />}
              text={approving ? t("approving") : t("approveAction")}
            />
            <Button variant="outline" onClick={() => setOpen(true)} disabled={approving}>
              <PencilLine className="size-4" aria-hidden />
              {t("overrideAction")}
            </Button>
          </>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("overrideTitle")}</DialogTitle>
            <DialogDescription>{t("overrideDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="override-score">{t("overrideScoreLabel")}</Label>
              <Input
                id="override-score"
                type="number"
                min={0}
                max={100}
                step="1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={!valueValid ? true : undefined}
              />
              <p className="text-muted-foreground text-xs">
                {t("overrideScoreHint", { computed: score.computedScore.toFixed(1) })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-reason">{t("overrideReasonLabel")}</Label>
              <Textarea
                id="override-reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={reason.trim().length === 0 ? true : undefined}
              />
              <p className="text-muted-foreground text-xs">{t("overrideReasonHint")}</p>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <LoadingButton
              text={t("overrideConfirm")}
              isLoading={saving}
              disabled={!valueValid || reason.trim().length === 0 || saving}
              onClick={() => void submitOverride()}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
