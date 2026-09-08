"use client";

import { AlertTriangle, CheckCircle2, FileText, Loader2, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/common/loading-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { needSummaryService } from "@/services/needs/need-summary.service";
import type { NeedSummary } from "@/services/needs/need-summary.types";

/**
 * RIO-AI-003 — the reviewer's view of a suggested need-description summary.
 *
 * Renders nothing at all when there is no summary: most descriptions are below
 * the threshold, and an empty "no summary" panel on every need would be noise.
 *
 * Three AC obligations shape this component:
 *   - AC 2, the summary is editable before it is saved — the textarea IS the
 *     draft, and Save writes it without confirming.
 *   - AC 3, never auto-approved — Confirm is a separate, deliberate second
 *     action, not something Save can do by accident.
 *   - AC 4, the original stays accessible — the source description is rendered
 *     beside the summary, always, never behind a fetch or a second click.
 *
 * Every write here is gated on aiReview:approve, not :write. The ticket names
 * one role (Human Reviewer), and in ROLE_MATRIX that role holds `approve` but
 * NOT `write` — so gating the edit on `write` would let Research Officer and
 * Data Analyst edit the summary while the reviewer could not. See
 * need-summary.controller.ts for the full reasoning, including why widening
 * the role matrix instead was rejected.
 */
export function NeedSummarySection({ needId }: { needId: string }) {
  const t = useTranslations("app.studies.needSummary");
  const canReview = usePermission("aiReview", "approve");

  const [summary, setSummary] = useState<NeedSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftText, setDraftText] = useState("");
  const [busy, setBusy] = useState<"save" | "confirm" | "regenerate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The mount site passes `key={need.id}`, so a different need gets a fresh
  // instance rather than reusing this one. That is what lets `loading` start
  // true from useState instead of being set synchronously here (which
  // react-hooks/set-state-in-effect rightly rejects), and it removes the
  // stale-response race entirely — a late reply from a previous need has no
  // component left to write into.
  useEffect(() => {
    const controller = new AbortController();
    needSummaryService
      .getForNeed(needId, controller.signal)
      .then((result) => {
        setSummary(result);
        setDraftText(result?.effectiveText ?? "");
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [needId]);

  function apply(next: NeedSummary) {
    setSummary(next);
    setDraftText(next.effectiveText);
    setError(null);
  }

  async function run(action: "save" | "confirm" | "regenerate") {
    if (!summary && action !== "regenerate") return;
    setBusy(action);
    setError(null);
    setSaved(false);
    try {
      if (action === "save") {
        apply(await needSummaryService.updateDraft(summary!.id, draftText));
        setSaved(true);
      } else if (action === "confirm") {
        // Save first when the reviewer edited but never pressed Save —
        // otherwise Confirm would silently sign off the text they replaced.
        const target =
          draftText.trim() !== summary!.effectiveText.trim()
            ? await needSummaryService.updateDraft(summary!.id, draftText)
            : summary!;
        apply(await needSummaryService.confirm(target.id));
      } else {
        apply(await needSummaryService.regenerate(needId));
      }
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="bg-muted h-40 animate-pulse rounded-md" />;
  }

  // No summary means the description was short enough not to need one. Say
  // nothing rather than explaining an absence on every short need.
  if (!summary) return null;

  const isDraft = summary.status === "DRAFT";
  const isConfirmed = summary.status === "CONFIRMED";
  const isStale = summary.status === "STALE";
  const hasWarnings = summary.verificationWarnings.length > 0;
  const dirty = draftText.trim() !== summary.effectiveText.trim();

  return (
    <section
      className="border-border bg-card space-y-4 rounded-lg border p-5"
      aria-labelledby="need-summary-heading"
    >
      <div className="flex flex-wrap items-center gap-3">
        <FileText className="text-muted-foreground size-4" aria-hidden />
        <h2 id="need-summary-heading" className="text-foreground text-sm font-semibold">
          {t("heading")}
        </h2>
        {isConfirmed ? (
          <Badge
            variant="outline"
            className="border-badge-success/40 bg-badge-success/10 text-badge-success-foreground"
          >
            <CheckCircle2 className="size-3" aria-hidden /> {t("statusConfirmed")}
          </Badge>
        ) : null}
        {isDraft ? <Badge variant="secondary">{t("statusDraft")}</Badge> : null}
        {isStale ? (
          <Badge
            variant="outline"
            className="border-badge-warning/40 bg-badge-warning/10 text-badge-warning-foreground"
          >
            {t("statusStale")}
          </Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        {t("intro", { length: summary.sourceLength })}
      </p>

      {isStale ? (
        <p className="text-badge-warning-foreground text-xs">{t("staleNote")}</p>
      ) : null}

      {/* AC 5 — the mechanical checks. Shown as "read this one closely", not
          as "this summary is wrong": the checks are conservative and the human
          gate below is what actually decides. */}
      {hasWarnings ? (
        <div className="border-badge-warning/40 bg-badge-warning/10 space-y-2 rounded-md border p-3">
          <p className="text-badge-warning-foreground flex items-center gap-2 text-xs font-medium">
            <AlertTriangle className="size-3.5" aria-hidden />
            {t("warningsHeading", { count: summary.verificationWarnings.length })}
          </p>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {summary.verificationWarnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>
                {t(`warning.${w.code}`, { detail: w.detail })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="need-summary-text">{t("summaryLabel")}</Label>
          {/* Deliberately NOT auto-translated: this is a reviewer verifying
              the AI summary against `sourceStatement` word-for-word (AC 5's
              hallucination checks), and it's the field they edit and save as
              `reviewerEditedText` — silently swapping its language here would
              undermine that review and could get a translated (not
              reviewed) sentence saved as the record of what the reviewer
              actually approved. `sourceStatement` above it is read-only
              reference text, so that one is auto-translated. */}
          <Textarea
            id="need-summary-text"
            rows={7}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={!canReview || !isDraft || busy !== null}
            aria-describedby="need-summary-model-note"
          />
          <p id="need-summary-model-note" className="text-muted-foreground text-xs">
            {summary.wasEdited
              ? t("editedNote")
              : t("modelNote", { model: summary.modelName })}
          </p>
        </div>

        {/* AC 4 — the original, always visible next to the summary. */}
        <div className="space-y-2">
          <Label htmlFor="need-summary-source">{t("sourceLabel")}</Label>
          <div
            id="need-summary-source"
            className="border-border bg-muted/40 text-muted-foreground max-h-48 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap"
          >
            <AutoTranslate text={summary.sourceStatement} />
          </div>
          <p className="text-muted-foreground text-xs">{t("sourceNote")}</p>
        </div>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {saved && !dirty ? (
        <p className="text-badge-success-foreground text-sm">{t("savedNote")}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canReview && isDraft ? (
          <LoadingButton
            text={t("confirmAction")}
            isLoading={busy === "confirm"}
            disabled={busy !== null || draftText.trim().length === 0}
            onClick={() => void run("confirm")}
          />
        ) : null}

        {canReview && isDraft ? (
          <Button
            variant="outline"
            disabled={busy !== null || !dirty || draftText.trim().length === 0}
            onClick={() => void run("save")}
          >
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            {t("saveAction")}
          </Button>
        ) : null}

        {canReview ? (
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void run("regenerate")}
          >
            {busy === "regenerate" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RotateCw className="size-4" aria-hidden />
            )}
            {t("regenerateAction")}
          </Button>
        ) : null}

        {/* The AC's human gate, stated where the decision is made. Shown to
            everyone who can see the need but cannot decide on it, so the
            absence of buttons reads as "not yours" rather than "broken". */}
        {isDraft && !canReview ? (
          <p className="text-muted-foreground text-xs">{t("awaitingReviewer")}</p>
        ) : null}
      </div>
    </section>
  );
}
