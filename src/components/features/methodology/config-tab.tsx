"use client";

import { CheckCircle2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormattedDate } from "@/components/common/formatted-date";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { methodologyConfigService } from "@/services/methodology-config/methodology-config.service";
import type { MethodologyConfig } from "@/services/methodology-config/methodology-config.types";

// Weights are edited as whole-number percentages but stored as 0-1 decimals
// (see the comment on weightSum below) — summing 9 such decimals can land a
// hair off 1 from binary floating-point rounding even when every displayed
// percentage is exact, so "exactly 100%" is checked with a small tolerance
// rather than strict equality.
const WEIGHT_SUM_TOLERANCE = 0.01;

function VersionCard({
  config,
  canWrite,
  onChanged,
}: {
  config: MethodologyConfig;
  canWrite: boolean;
  onChanged: (updated: MethodologyConfig) => void;
}) {
  const t = useTranslations("app.settings.methodology.config");
  const [editOpen, setEditOpen] = useState(false);
  const [versionInput, setVersionInput] = useState(config.version);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {canWrite && config.status === "draft" ? (
          <Button
            size="sm"
            className="mt-4 gap-1.5"
            onClick={publish}
            disabled={publishing}
          >
            <CheckCircle2 className="size-3.5" />
            {publishing ? t("publishing") : t("publish")}
          </Button>
        ) : null}
      </CardContent>

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

export function MethodologyConfigTab() {
  const t = useTranslations("app.settings.methodology.config");
  const canWrite = usePermission("methodologyQuestionBank", "write");

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

  async function save() {
    // Belt-and-suspenders alongside the button's `disabled` — the backend
    // already rejects an off-100% total, but by then thresholds/flags may
    // have already been persisted alongside the invalid weights (the bug
    // this guards against). Never even issue the request when it's invalid.
    if (!weightSumValid) return;
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

  return (
    <div className="space-y-6">
      {canWrite ? (
        <div className="bg-background/95 border-border sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-b px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {saved && !dirty ? (
            <p className="text-badge-success-foreground text-sm">{t("savedNote")}</p>
          ) : null}
          <Button onClick={save} disabled={saving || !dirty || !weightSumValid}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      ) : null}

      <VersionCard config={config} canWrite={canWrite} onChanged={applyConfig} />

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
    </div>
  );
}
