"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type {
  DuplicateCandidate,
  DuplicateNeedSummary,
} from "@/services/data-quality/data-quality.types";

interface DuplicateQueueProps {
  candidates: DuplicateCandidate[];
  canDecide: boolean;
  onDecided: () => void;
  /** Opens the merge dialog for a pair already confirmed as duplicates. */
  onMerge: (candidate: DuplicateCandidate) => void;
}

/**
 * Q40's shared queue: one screen for FR-002's literal candidates and
 * RIO-AI-004's semantic ones, distinguished by a badge rather than by living
 * on separate pages.
 *
 * Laid out as side-by-side cards rather than table rows because the decision
 * is a COMPARISON — a reviewer has to read both statements against each other,
 * and two truncated cells in one row make that impossible.
 */
export function DuplicateQueue({
  candidates,
  canDecide,
  onDecided,
  onMerge,
}: DuplicateQueueProps) {
  const t = useTranslations("app.dataQuality.duplicates");

  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">{t("empty")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {candidates.map((candidate) => (
        <DuplicatePairCard
          key={candidate.id}
          candidate={candidate}
          canDecide={canDecide}
          onDecided={onDecided}
          onMerge={onMerge}
        />
      ))}
    </div>
  );
}

function DuplicatePairCard({
  candidate,
  canDecide,
  onDecided,
  onMerge,
}: {
  candidate: DuplicateCandidate;
  canDecide: boolean;
  onDecided: () => void;
  onMerge: (candidate: DuplicateCandidate) => void;
}) {
  const t = useTranslations("app.dataQuality.duplicates");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const decide = async (decision: "confirmed_duplicate" | "not_duplicate") => {
    if (decision === "not_duplicate" && !note.trim()) {
      setError(t("noteRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await dataQualityService.decideDuplicate(
        candidate.id,
        decision,
        note.trim() || undefined,
      );
      onDecided();
    } catch {
      setError(t("decisionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={candidate.method === "semantic" ? "default" : "secondary"}>
              {t(`method.${candidate.method}`)}
            </Badge>
            <Badge variant="outline">{t(`scope.${candidate.scope}`)}</Badge>
            <span className="text-muted-foreground text-sm tabular-nums">
              {t("similarity", { value: Math.round(candidate.score * 100) })}
            </span>
          </span>
          {candidate.status !== "pending" && (
            <Badge variant="secondary">{t(`status.${candidate.status}`)}</Badge>
          )}
        </div>

        {candidate.aiReason && (
          // Only a semantic pair has one. Shown because a reviewer deciding on
          // a model's proposal is entitled to its reasoning.
          <p dir="auto" className="text-muted-foreground text-sm italic">
            {candidate.aiReason}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <NeedPanel need={candidate.needA} expanded={expanded} />
          <NeedPanel need={candidate.needB} expanded={expanded} />
        </div>

        <Button variant="ghost" size="sm" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? t("showLess") : t("showMore")}
        </Button>

        {candidate.status === "pending" &&
          (canDecide ? (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor={`dup-note-${candidate.id}`}>{t("note")}</Label>
              <Textarea
                id={`dup-note-${candidate.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("notePlaceholder")}
                rows={2}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void decide("not_duplicate")}
                >
                  {t("actions.notDuplicate")}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void decide("confirmed_duplicate")}
                >
                  {t("actions.confirmDuplicate")}
                </Button>
              </div>
              {/* Confirming and merging are separate acts, and the wording says
                  so: a reviewer can record that two needs are the same without
                  committing to combining them in the same click. */}
              <p className="text-muted-foreground text-xs">{t("confirmThenMerge")}</p>
            </div>
          ) : (
            <p className="text-muted-foreground border-t pt-4 text-xs">{t("readOnly")}</p>
          ))}

        {/* Merge is offered only on a pair someone has already confirmed IS a
            duplicate. Merging straight from an unreviewed proposal would let
            the system's guess become an irreversible-looking action in one
            click, which is the opposite of Q11's propose-only rule. */}
        {candidate.status === "confirmed_duplicate" && canDecide && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <p className="text-muted-foreground text-xs">{t("readyToMerge")}</p>
            <Button size="sm" onClick={() => onMerge(candidate)}>
              {t("actions.merge")}
            </Button>
          </div>
        )}

        {candidate.note && (
          <p dir="auto" className="text-muted-foreground border-t pt-3 text-sm">
            {t("reviewerNote")}: {candidate.note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NeedPanel({
  need,
  expanded,
}: {
  need: DuplicateNeedSummary | null;
  expanded: boolean;
}) {
  const t = useTranslations("app.dataQuality.duplicates");
  if (!need)
    return <div className="text-muted-foreground rounded-md border p-3 text-sm">—</div>;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-muted-foreground font-mono text-xs">{need.reference}</p>
      <p dir="auto" className="text-sm font-medium">
        {need.title}
      </p>
      <p dir="auto" className={expanded ? "text-sm" : "line-clamp-3 text-sm"}>
        {need.statement}
      </p>
      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
        {need.studyTitle && (
          <>
            <dt>{t("fields.study")}</dt>
            <dd dir="auto">{need.studyTitle}</dd>
          </>
        )}
        {need.domain && (
          <>
            <dt>{t("fields.domain")}</dt>
            <dd dir="auto">
              {need.domain}
              {need.subDomain ? ` · ${need.subDomain}` : ""}
            </dd>
          </>
        )}
        {need.village.length > 0 && (
          <>
            <dt>{t("fields.village")}</dt>
            <dd dir="auto">{need.village.join(", ")}</dd>
          </>
        )}
        {need.referenceId && (
          <>
            <dt>{t("fields.referenceId")}</dt>
            <dd dir="auto">{need.referenceId}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
