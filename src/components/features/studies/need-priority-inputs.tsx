"use client";

import { AlertTriangle, Loader2, RotateCw, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import {
  URGENCY_LEVELS,
  needThemesService,
  type UrgencyLevel,
} from "@/services/needs/need-themes.service";
import type { Need } from "@/services/needs/needs.types";

/**
 * RIO-FR-003 AC 1 and AC 6 — the two inputs the priority score needs that
 * nothing else in the app collects.
 *
 * They sit together because they answer the same reviewer question in two
 * halves: *how soon* does this matter (urgency), and *how widely* does it
 * matter (themes, via the recurrence factor). Both feed the score, and both
 * are visible here rather than buried in the scoring screen, so the reviewer
 * fixes them where they are looking at the need itself.
 *
 * Urgency is never inferred. The methodology names it as a factor but gives no
 * measurement rule, so deriving it from severity or gap type would be
 * inventing methodology — an unset urgency stays unset and scores as
 * unmeasured.
 */
export function NeedPriorityInputs({
  need,
  onNeedUpdated,
}: {
  need: Need;
  onNeedUpdated: (next: Need) => void;
}) {
  const tU = useTranslations("app.studies.urgency");
  const tT = useTranslations("app.studies.themes");
  const canEdit = usePermission("priorityScoring", "write");

  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function setUrgency(next: string) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const level = next === "__unset" ? null : (next as UrgencyLevel);
      onNeedUpdated(await needThemesService.setUrgency(need.id, level));
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : tU("saved"));
    } finally {
      setSaving(false);
    }
  }

  async function reExtract() {
    setExtracting(true);
    setError(null);
    try {
      const themes = await needThemesService.extract(need.id);
      onNeedUpdated({ ...need, themes });
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : tT("genericError"));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <section
      className="border-border bg-card grid gap-5 rounded-lg border p-5 lg:grid-cols-2"
      aria-labelledby="need-priority-inputs-heading"
    >
      <div className="space-y-2">
        <Label htmlFor="need-urgency" id="need-priority-inputs-heading">
          {tU("label")}
        </Label>
        <Select
          value={need.urgency ?? "__unset"}
          onValueChange={(v) => void setUrgency(v)}
          disabled={!canEdit || saving}
        >
          <SelectTrigger id="need-urgency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset">{tU("notSet")}</SelectItem>
            {URGENCY_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {tU(level)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">{tU("hint")}</p>
        {saving ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Loader2 className="size-3 animate-spin" aria-hidden />
          </p>
        ) : null}
        {saved && !saving ? (
          <p className="text-badge-success-foreground text-xs">{tU("saved")}</p>
        ) : null}
        {/* An unset urgency is a real gap in the score, not a cosmetic one —
            say so where it can be fixed. */}
        {!need.urgency ? (
          <p className="text-badge-warning-foreground flex items-start gap-1.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
            {tU("notSet")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Tags className="text-muted-foreground size-4" aria-hidden />
          <Label>{tT("label")}</Label>
        </div>
        {need.themes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {need.themes.map((theme) => (
              <Badge key={theme} variant="secondary">
                {theme}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{tT("none")}</p>
        )}
        <p className="text-muted-foreground text-xs">{tT("hint")}</p>
        {canEdit ? (
          <Button variant="ghost" disabled={extracting} onClick={() => void reExtract()}>
            {extracting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RotateCw className="size-4" aria-hidden />
            )}
            {tT("extractAction")}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm lg:col-span-2">{error}</p> : null}
    </section>
  );
}
