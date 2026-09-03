"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type {
  CleaningFlag,
  PlaceCandidate,
} from "@/services/data-quality/data-quality.types";

interface FlagReviewDialogProps {
  flag: CleaningFlag | null;
  onClose: () => void;
  onDecided: () => void;
}

/**
 * One decision on one finding (AC 4).
 *
 * Accept writes the correction onto the record; reject records that the stored
 * value is right as it stands. A note is MANDATORY on reject and optional on
 * accept — accepting a proposal explains itself, while overruling the rule set
 * is the decision a later reader needs a reason for. That mirrors the
 * mandatory-note pattern already used for score overrides.
 */
export function FlagReviewDialog({ flag, onClose, onDecided }: FlagReviewDialogProps) {
  const t = useTranslations("app.dataQuality");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!flag) return null;

  const candidates = (flag.detail?.candidates ?? []) as PlaceCandidate[];
  const canAccept = flag.acceptable;

  const decide = async (decision: "accept" | "reject") => {
    if (decision === "reject" && !note.trim()) {
      setError(t("noteRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await dataQualityService.review(flag.id, decision, note.trim() || undefined);
      onDecided();
    } catch {
      setError(t("decisionError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(`rule.${flag.ruleCode}`)}</DialogTitle>
          <DialogDescription dir="auto">
            {flag.entityLabel ?? "—"} · <span className="font-mono">{flag.field}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {t("columns.current")}
              </Label>
              <p dir="auto" className="rounded-md border px-3 py-2 text-sm break-words">
                {flag.originalValue ?? <span className="italic">{t("noValue")}</span>}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {t("columns.proposed")}
              </Label>
              <p dir="auto" className="rounded-md border px-3 py-2 text-sm break-words">
                {flag.proposedValue ??
                  (canAccept
                    ? (flag.detail?.proposedShape ?? t("recomputedOnAccept"))
                    : t("fixOnRecord"))}
              </p>
            </div>
          </div>

          {flag.detail?.redacted && (
            <p className="text-muted-foreground text-xs">{t("redactedExplainer")}</p>
          )}

          {flag.detail?.dayFirst && flag.detail?.monthFirst && (
            // The one case where the reviewer is choosing a READING, not
            // confirming a reformat — both have to be on screen.
            <p className="text-sm">
              {t("ambiguousDate", {
                dayFirst: String(flag.detail.dayFirst),
                monthFirst: String(flag.detail.monthFirst),
              })}
            </p>
          )}

          {flag.detail?.belongsTo && (
            <p className="text-sm">
              {t("wrongDomain", {
                filedUnder: String(flag.detail.filedUnder ?? ""),
                belongsTo: String(flag.detail.belongsTo),
              })}
            </p>
          )}

          {candidates.length > 0 && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">{t("candidates")}</Label>
              <ul className="space-y-1 text-sm">
                {candidates.map((candidate) => (
                  <li
                    key={candidate.code}
                    className="flex items-center justify-between gap-3"
                  >
                    <span dir="auto">
                      {candidate.name}
                      {candidate.governorate ? ` · ${candidate.governorate}` : ""}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">
                      {candidate.code} · {Math.round(candidate.score * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="flag-note">{t("note")}</Label>
            <Textarea
              id="flag-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("notePlaceholder")}
              rows={3}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => void decide("reject")}
            disabled={submitting}
          >
            {t("actions.reject")}
          </Button>
          <Button
            onClick={() => void decide("accept")}
            disabled={submitting || !canAccept}
          >
            {t("actions.accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
