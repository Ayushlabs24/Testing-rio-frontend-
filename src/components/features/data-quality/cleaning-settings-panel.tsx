"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/services/api/types";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type { CleaningSettings } from "@/services/data-quality/data-quality.types";

interface CleaningSettingsPanelProps {
  /** dataQuality:write — Q23 gives tuning to System Admin and Data Analyst. */
  canTune: boolean;
  onSaved: () => void;
}

/**
 * RIO-FR-002 / Q23 — "start conservative and tune once real field data
 * exists. Tuning ownership: System Admin / Data Analyst."
 *
 * Deliberately explains what each dial DOES rather than just naming it. A
 * threshold with no stated consequence gets moved by whoever is most annoyed
 * by the queue that day, which is how a detector quietly stops detecting.
 *
 * Retuning never rewrites a decision already taken: every flag and every
 * duplicate candidate stores the threshold it was raised under.
 */
export function CleaningSettingsPanel({ canTune, onSaved }: CleaningSettingsPanelProps) {
  const t = useTranslations("app.dataQuality.settings");
  const [settings, setSettings] = useState<CleaningSettings | null>(null);
  const [draft, setDraft] = useState<CleaningSettings>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) =>
      dataQualityService
        .getSettings(signal)
        .then((result) => {
          setSettings(result);
          setDraft({});
          // A previous attempt may have failed; a success is the answer now.
          setError(null);
        })
        .catch((cause: unknown) => {
          // A cancelled request is not a failure. React runs this effect
          // twice on mount in development, and the cleanup aborts the first
          // one — reporting that as "couldn't load" put a red error under a
          // panel that had just filled in correctly.
          if (cause instanceof ApiError && cause.cancelled) return;
          setError(t("loadError"));
        }),
    [t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!settings) return null;

  const value = <K extends keyof CleaningSettings>(key: K): CleaningSettings[K] =>
    (draft[key] ?? settings[key]) as CleaningSettings[K];

  const setNumber = (key: keyof CleaningSettings) => (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    setDraft((prev) => ({ ...prev, [key]: parsed }));
    setSaved(false);
  };

  const dirty = Object.keys(draft).length > 0;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await dataQualityService.updateSettings(draft);
      setSettings(result);
      setDraft({});
      setSaved(true);
      onSaved();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const thresholds: {
    key: keyof CleaningSettings;
    step: string;
    min: string;
    max: string;
  }[] = [
    { key: "villageMatchAcceptThreshold", step: "0.01", min: "0.5", max: "1" },
    { key: "villageMatchProposeThreshold", step: "0.01", min: "0.3", max: "1" },
    { key: "literalDuplicateThreshold", step: "0.01", min: "0.5", max: "1" },
    { key: "classificationNearMatchThreshold", step: "0.01", min: "0.3", max: "1" },
  ];

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
          <p className="text-muted-foreground text-xs">
            {t("version", { version: settings.methodologyVersion ?? "—" })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {thresholds.map(({ key, step, min, max }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{t(`fields.${key}.label`)}</Label>
              <Input
                id={key}
                type="number"
                inputMode="decimal"
                step={step}
                min={min}
                max={max}
                disabled={!canTune}
                value={String(value(key) ?? "")}
                onChange={(event) => setNumber(key)(event.target.value)}
                className="tabular-nums"
              />
              <p className="text-muted-foreground text-xs">{t(`fields.${key}.help`)}</p>
            </div>
          ))}

          <div className="space-y-1">
            <Label htmlFor="dontKnowTreatment">
              {t("fields.dontKnowTreatment.label")}
            </Label>
            <Select
              value={value("dontKnowTreatment") ?? "excluded_answer"}
              disabled={!canTune}
              onValueChange={(next) => {
                setDraft((prev) => ({
                  ...prev,
                  dontKnowTreatment: next as CleaningSettings["dontKnowTreatment"],
                }));
                setSaved(false);
              }}
            >
              <SelectTrigger id="dontKnowTreatment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excluded_answer">{t("dk.excluded_answer")}</SelectItem>
                <SelectItem value="missing_value">{t("dk.missing_value")}</SelectItem>
              </SelectContent>
            </Select>
            {/* The client asked us to confirm this before making it
                platform-wide, so the screen says which way it is set. */}
            <p className="text-muted-foreground text-xs">
              {t("fields.dontKnowTreatment.help")}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">{t("retuneNote")}</p>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && !dirty && (
          <p className="text-sm text-emerald-600 dark:text-emerald-500">{t("saved")}</p>
        )}

        {canTune ? (
          <Button onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        ) : (
          <p className="text-muted-foreground text-xs">{t("readOnly")}</p>
        )}
      </CardContent>
    </Card>
  );
}
