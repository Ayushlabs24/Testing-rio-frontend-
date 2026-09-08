"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormattedDate } from "@/components/common/formatted-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type { MergeHistoryItem } from "@/services/data-quality/data-quality.types";

interface MergeHistoryProps {
  merges: MergeHistoryItem[];
  canDecide: boolean;
  onUndone: () => void;
}

/**
 * RIO-AI-004 — the record of every merge, including the ones that were undone.
 *
 * Undone merges stay in the list on purpose: "these two were merged and then
 * reversed, by whom and why" is precisely the history an auditor comes here
 * for, and hiding it would leave a gap that looks like nothing ever happened.
 */
export function MergeHistory({ merges, canDecide, onUndone }: MergeHistoryProps) {
  const t = useTranslations("app.dataQuality.mergeHistory");

  if (merges.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">{t("empty")}</p>
    );
  }

  return (
    <div className="space-y-3">
      {merges.map((merge) => (
        <MergeRow
          key={merge.id}
          merge={merge}
          canDecide={canDecide}
          onUndone={onUndone}
        />
      ))}
    </div>
  );
}

function MergeRow({
  merge,
  canDecide,
  onUndone,
}: {
  merge: MergeHistoryItem;
  canDecide: boolean;
  onUndone: () => void;
}) {
  const t = useTranslations("app.dataQuality.mergeHistory");
  const [undoing, setUndoing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitUndo = async () => {
    // Required, and checked here as well as by the service and a database
    // CHECK: an undo without a reason is the one thing a later reader cannot
    // reconstruct.
    if (!note.trim()) {
      setError(t("noteRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await dataQualityService.undoMerge(merge.id, note.trim());
      onUndone();
    } catch {
      setError(t("undoError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm">
              {t.rich("summary", {
                retired: merge.retired?.reference ?? "—",
                survivor: merge.survivor?.reference ?? "—",
                strong: (chunks) => <strong className="font-mono">{chunks}</strong>,
              })}
            </p>
            <p dir="auto" className="text-muted-foreground text-sm">
              {merge.survivor?.title ?? ""}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("decided", { name: merge.decidedByName ?? "—" })}{" "}
              <FormattedDate value={merge.decidedAt} />
              {" · "}
              {t("itemsMoved", { count: merge.transferredCount })}
            </p>
          </div>
          {merge.undoneAt ? (
            <Badge variant="secondary">{t("undone")}</Badge>
          ) : (
            <Badge>{t("active")}</Badge>
          )}
        </div>

        {merge.note && (
          <p dir="auto" className="text-muted-foreground text-sm">
            {t("note")}: {merge.note}
          </p>
        )}

        {merge.undoneAt && (
          <div className="border-t pt-3">
            <p className="text-muted-foreground text-xs">
              {t("undoneBy", { name: merge.undoneByName ?? "—" })}{" "}
              <FormattedDate value={merge.undoneAt} />
            </p>
            {merge.undoNote && (
              <p dir="auto" className="text-muted-foreground mt-1 text-sm">
                {t("undoNote")}: {merge.undoNote}
              </p>
            )}
          </div>
        )}

        {merge.canUndo &&
          canDecide &&
          (undoing ? (
            <div className="space-y-2 border-t pt-3">
              <Label htmlFor={`undo-note-${merge.id}`}>{t("undoNoteLabel")}</Label>
              <Textarea
                id={`undo-note-${merge.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("undoNotePlaceholder")}
                rows={2}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              {/* The alias is the one thing an undo does NOT reverse, and a
                  reviewer should know that before clicking rather than after. */}
              <p className="text-muted-foreground text-xs">{t("undoKeepsAlias")}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUndoing(false)}
                  disabled={busy}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void submitUndo()}
                  disabled={busy}
                >
                  {busy ? t("undoing") : t("confirmUndo")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => setUndoing(true)}>
                {t("undo")}
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
