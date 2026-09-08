"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type {
  DuplicateCandidate,
  MergePreview,
} from "@/services/data-quality/data-quality.types";

interface MergeDialogProps {
  candidate: DuplicateCandidate | null;
  onClose: () => void;
  onMerged: () => void;
}

/**
 * RIO-AI-004 — merging a confirmed duplicate pair.
 *
 * Two things this screen refuses to do on the reviewer's behalf:
 *
 * 1. It does not pick the survivor. Neither "the older one" nor "the one with
 *    more responses" is right in general — the reviewer knows which entry is
 *    the good one, so choosing is the first thing they do here.
 * 2. It does not describe the outcome in the abstract. The preview is fetched
 *    from the server for the exact direction chosen and re-fetched when that
 *    direction is flipped, so what is on screen is what will happen. This is
 *    also the worked example the client asked for in Q24.
 */
export function MergeDialog({ candidate, onClose, onMerged }: MergeDialogProps) {
  const t = useTranslations("app.dataQuality.merge");
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needA = candidate?.needA ?? null;
  const needB = candidate?.needB ?? null;
  const chosenSurvivor = survivorId ?? needA?.id ?? null;
  const retiredId =
    chosenSurvivor && needA && needB
      ? chosenSurvivor === needA.id
        ? needB.id
        : needA.id
      : null;

  const loadPreview = useCallback(
    (signal?: AbortSignal) => {
      if (!chosenSurvivor || !retiredId) return Promise.resolve();
      return dataQualityService
        .previewMerge(chosenSurvivor, retiredId, signal)
        .then((result) => {
          setPreview(result);
          setError(null);
        })
        .catch(() => setError(t("previewError")))
        .finally(() => setLoading(false));
    },
    [chosenSurvivor, retiredId, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadPreview(controller.signal);
    return () => controller.abort();
  }, [loadPreview]);

  if (!candidate || !needA || !needB) return null;

  const submit = async () => {
    if (!chosenSurvivor || !retiredId) return;
    setSubmitting(true);
    setError(null);
    try {
      await dataQualityService.merge({
        survivorNeedId: chosenSurvivor,
        retiredNeedId: retiredId,
        candidateId: candidate.id,
        note: note.trim() || undefined,
      });
      onMerged();
    } catch {
      setError(t("mergeError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t("chooseSurvivor")}</Label>
            <RadioGroup
              value={chosenSurvivor ?? undefined}
              onValueChange={(value) => {
                setLoading(true);
                setSurvivorId(value);
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              {[needA, needB].map((need) => (
                <label
                  key={need.id}
                  htmlFor={`survivor-${need.id}`}
                  className="has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <RadioGroupItem
                    id={`survivor-${need.id}`}
                    value={need.id}
                    className="mt-0.5"
                  />
                  <span className="space-y-1">
                    <span className="text-muted-foreground block font-mono text-xs">
                      {need.reference}
                    </span>
                    <span dir="auto" className="block font-medium">
                      {need.title}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {loading || !preview ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-4 rounded-md border p-4">
              <p className="text-sm">
                {t.rich("outcome", {
                  retired: preview.retired.reference,
                  survivor: preview.survivor.reference,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>

              {preview.transfers.length > 0 ? (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    {t("movesLabel", { count: preview.totalTransfers })}
                  </Label>
                  <ul className="text-sm">
                    {preview.transfers.map((transfer) => (
                      <li
                        key={transfer.entityType}
                        className="flex justify-between gap-3"
                      >
                        <span>{t(`entity.${transfer.entityType}`)}</span>
                        <span className="tabular-nums">{transfer.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t("movesNothing")}</p>
              )}

              {/* The guarantees, said plainly. A reviewer should not have to
                  infer that an old reference keeps working or that published
                  reports are safe. */}
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>{t("guarantee.alias", { reference: preview.aliasedReference })}</li>
                <li>{t("guarantee.notDeleted")}</li>
                {preview.frozenReportCount > 0 && (
                  <li>
                    {t("guarantee.frozenReports", { count: preview.frozenReportCount })}
                  </li>
                )}
                <li>{t("guarantee.rescore")}</li>
                <li>{t("guarantee.undo")}</li>
              </ul>

              {preview.warnings.map((warning) => (
                <p
                  key={warning.code}
                  className="text-sm text-amber-600 dark:text-amber-500"
                >
                  {t(`warning.${warning.code}`, { count: warning.count ?? 0 })}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="merge-note">{t("note")}</Label>
            <Textarea
              id="merge-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("notePlaceholder")}
              rows={2}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || loading || !preview}
          >
            {submitting ? t("merging") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
