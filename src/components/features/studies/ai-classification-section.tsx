"use client";

import { CheckCircle2, Loader2, Sparkles, UserCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { domainsService } from "@/services/domains/domains.service";
import { aiDecisionsService } from "@/services/ai-decisions/ai-decisions.service";
import type { AiDecision } from "@/services/ai-decisions/ai-decisions.types";
import { ApiError } from "@/services/api/types";
import type { StudyStatus } from "@/services/studies/studies.types";

/**
 * Editable chip list for the reviewer's domain/sub-domain override. `options`
 * is always the live, active Domain/SubDomain master list (see
 * domainsService) — a reviewer can only pick from that list, never type an
 * ad-hoc value, since Domain/SubDomain already has its own master-data
 * screen (Settings → Methodology) for adding new ones.
 */
function ChipEditor({
  values,
  onChange,
  options,
  loading = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  loading?: boolean;
}) {
  const t = useTranslations("app.studies.classification");
  const addFromOptions = (value: string) => {
    if (value && !values.includes(value)) onChange([...values, value]);
  };
  const remaining = options.filter((option) => !values.includes(option));

  return (
    <div className="space-y-1.5">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <Select value="" onValueChange={addFromOptions} disabled={loading}>
        <SelectTrigger className="h-8 w-full">
          <SelectValue
            placeholder={loading ? t("loadingMethodology") : t("selectFromMethodology")}
            className="truncate"
          />
        </SelectTrigger>
        <SelectContent>
          {remaining.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Confidence read as a tiered progress bar, not just a number — green/amber/red
 * mirrors how a reviewer should weigh trusting the suggestion at a glance. */
function ConfidenceMeter({ value }: { value: number }) {
  const t = useTranslations("app.studies.classification");
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.7 ? "bg-success" : value >= 0.4 ? "bg-warning" : "bg-destructive";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{t("confidence")}</span>
        <span className="text-foreground font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="bg-background/60 h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DomainChips({
  items,
  variant,
  border = false,
}: {
  items: string[];
  variant: "primary" | "secondary";
  border?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item}
          className={cn(
            border && `border border-${variant === "primary" ? "primary" : "secondary"}`,
            variant === "primary"
              ? "bg-badge-primary text-badge-primary-foreground"
              : "bg-badge-secondary text-badge-secondary-foreground",
          )}
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function AiClassificationSection({
  studyId,
  studyStatus,
  hasNeed,
  evidenceCount,
  onReviewed,
}: {
  studyId: string;
  studyStatus: StudyStatus;
  hasNeed: boolean;
  evidenceCount: number;
  /** Fires after an approved/modified review — Study.domain/subDomain just
   * changed server-side, so the parent should refetch the Study. */
  onReviewed?: () => void;
}) {
  const t = useTranslations("app.studies.classification");
  const canRun = usePermission("aiReview", "write");
  const canReview = usePermission("aiReview", "approve");

  const [latest, setLatest] = useState<AiDecision | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [overrideDomains, setOverrideDomains] = useState<string[]>([]);
  const [overrideSubDomains, setOverrideSubDomains] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);

  // Same source (and same active-only filter) as the backend's Gemini
  // candidate list (AiDecisionsService.runClassification) — the override
  // modal must only ever offer domains/sub-domains the AI was actually
  // allowed to pick from, never a separate hardcoded list.
  const [domainOptions, setDomainOptions] = useState<
    { name: string; subDomains: string[] }[] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    aiDecisionsService
      .listByStudy(studyId)
      .then((list) => {
        if (!cancelled) setLatest(list[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  useEffect(() => {
    let cancelled = false;
    // One request for every active domain's active sub-domains, nested —
    // not one listSubDomains() call per domain (that N+1 pattern was ~10
    // network round trips just to open this section).
    domainsService
      .listWithSubDomains()
      .then((domains) => {
        if (cancelled) return;
        setDomainOptions(
          domains
            .filter((d) => d.isActive)
            .map((d) => ({
              name: d.name,
              subDomains: d.subDomains.filter((sd) => sd.isActive).map((sd) => sd.name),
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setDomainOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const domainOptionsLoading = domainOptions === null;
  const domainNames = (domainOptions ?? []).map((d) => d.name);
  const subDomainNamesFor = (domains: string[]): string[] => {
    if (!domainOptions) return [];
    if (domains.length === 0) {
      return Array.from(new Set(domainOptions.flatMap((d) => d.subDomains)));
    }
    const set = new Set<string>();
    for (const domain of domains) {
      const match = domainOptions.find((d) => d.name === domain);
      for (const sub of match?.subDomains ?? []) set.add(sub);
    }
    return Array.from(set);
  };

  if (!canRun) return null;

  // evidence_submitted or further (ai_classified/human_reviewed) means
  // evidence has been through the explicit Submit step at least once.
  const isEligible =
    hasNeed && studyStatus !== "draft" && studyStatus !== "need_captured";

  const runClassify = async () => {
    setError(null);
    setIsRunning(true);
    try {
      const result = await aiDecisionsService.classify(studyId);
      setLatest(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("classifyError"));
    } finally {
      setIsRunning(false);
    }
  };

  const startOverride = () => {
    if (!latest) return;
    // Only pre-fill with values that actually exist in the live methodology
    // list — Gemini's raw suggestion is free-form text and, despite the
    // prompt instructing it to pick an exact name, isn't guaranteed to match
    // verbatim. Pre-filling an unmatched value would silently exclude it
    // from the dropdown (already "selected") with no way to tell why —
    // exactly the confusion this is meant to avoid. If it doesn't match,
    // the reviewer picks from the dropdown instead; the raw suggestion is
    // still shown for reference below.
    const suggestedDomains = (latest.suggestion.domains ?? []).filter((d) =>
      domainNames.includes(d),
    );
    const eligibleSubDomains = subDomainNamesFor(suggestedDomains);
    const suggestedSubDomains = (latest.suggestion.subDomains ?? []).filter((sd) =>
      eligibleSubDomains.includes(sd),
    );
    setOverrideDomains(suggestedDomains);
    setOverrideSubDomains(suggestedSubDomains);
    setOverrideReason("");
    setOverriding(true);
  };

  const submitReview = async (decision: "approved" | "modified") => {
    if (!latest) return;
    setError(null);
    setIsReviewing(true);
    try {
      const updated = await aiDecisionsService.review(latest.id, {
        decision,
        ...(decision === "modified"
          ? {
              notes: overrideReason,
              overrideValue: { domains: overrideDomains, subDomains: overrideSubDomains },
            }
          : {}),
      });
      setLatest(updated);
      setOverriding(false);
      if (decision === "approved" || decision === "modified") onReviewed?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("reviewError"));
    } finally {
      setIsReviewing(false);
    }
  };

  const overrideValue = latest?.humanDecision?.overrideValue as
    { domains?: string[]; subDomains?: string[] } | undefined;
  const isModified = latest?.humanDecision?.decision === "modified";

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* A section, not a boxed-in card — a tinted header strip like the
       * other workflow steps, running the full width of the page. */}
      <div className="bg-primary/5 border-border flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
            <Sparkles className="size-3.5" />
          </span>
          {t("heading")}
        </h2>
        <Badge
          className={cn(
            "border-transparent",
            latest?.humanDecision
              ? "bg-badge-success text-badge-success-foreground"
              : latest
                ? "bg-badge-primary text-badge-primary-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {latest?.humanDecision
            ? t("statusReviewed")
            : latest
              ? t("statusClassified")
              : t("statusPending")}
        </Badge>
      </div>

      <div className="space-y-5 p-5">
        {!isEligible ? (
          <p className="text-muted-foreground text-sm">
            {!hasNeed
              ? t("waitingForNeed")
              : evidenceCount === 0
                ? t("waitingForEvidence")
                : t("waitingForSubmit")}
          </p>
        ) : null}

        {isEligible && !latest ? (
          <div className="flex flex-col items-start gap-3">
            <div>
              <p className="text-foreground text-sm font-medium">
                {t("readyToClassify")}
              </p>
              <p className="text-muted-foreground text-sm">{t("readyToClassifyHint")}</p>
            </div>
            <Button
              type="button"
              onClick={runClassify}
              disabled={isRunning}
              className="gap-2"
            >
              {isRunning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isRunning ? t("classifying") : t("runClassification")}
            </Button>
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {latest ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* AI Suggestion — a solid brand-secondary tint (not a washed-out
             * opacity blend, which reads as gray), clearly AI's voice.
             * Spans two of the three columns so domains/rationale read
             * horizontally next to confidence + review actions. */}
            <div className="bg-badge-secondary space-y-4 rounded-lg p-4 lg:col-span-2">
              <p className="text-badge-secondary-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Sparkles className="size-3.5" />
                {t("aiSuggestionHeading")}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("suggestedDomains")}
                  </p>
                  <DomainChips
                    items={latest.suggestion.domains ?? []}
                    variant="primary"
                    border={true}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("suggestedSubDomains")}
                  </p>
                  <DomainChips
                    items={latest.suggestion.subDomains ?? []}
                    variant="secondary"
                    border={true}
                  />
                </div>
              </div>

              {latest.suggestion.rationale ? (
                <div className="border-border/60 border-t pt-3">
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    {t("rationaleHeading")}
                  </p>
                  <p className="text-foreground/80 text-xs leading-relaxed italic">
                    {latest.suggestion.rationale}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Confidence + review actions/final decision — the "metrics and
             * comparison" column sitting next to the suggestion, not below it. */}
            <div className="space-y-4">
              <div className="border-border rounded-lg border p-4">
                <ConfidenceMeter value={latest.confidence} />
              </div>

              {/* Human Review — distinct from AI: a plain surface with a
               * single accent border, not another solid color fill —
               * the two colored panels (AI Suggestion, Final Decision)
               * carry enough weight on their own. */}
              {!latest.humanDecision && canReview ? (
                <div className="border-border border-l-primary space-y-3 rounded-lg border border-l-4 p-4">
                  <p className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    <UserCheck className="text-primary size-3.5" />
                    {t("humanReviewHeading")}
                  </p>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => submitReview("approved")}
                      disabled={isReviewing}
                      className="gap-1.5"
                    >
                      {isReviewing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {isReviewing ? t("approving") : t("approve")}
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={startOverride}
                      disabled={isReviewing}
                    >
                      {t("override")}
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Final Decision — the confirmation state, once a reviewer has acted */}
              {latest.humanDecision ? (
                <div className="bg-badge-success space-y-3 rounded-lg p-4">
                  <p className="text-badge-success-foreground flex items-center gap-1.5 text-sm font-semibold">
                    <CheckCircle2 className="size-4" />
                    {isModified ? t("humanOverrideSaved") : t("classificationApproved")}
                  </p>
                  {isModified && overrideValue ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-muted-foreground text-xs font-medium">
                          {t("suggestedDomains")}
                        </p>
                        <DomainChips
                          items={overrideValue.domains ?? []}
                          variant="primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-muted-foreground text-xs font-medium">
                          {t("suggestedSubDomains")}
                        </p>
                        <DomainChips
                          items={overrideValue.subDomains ?? []}
                          variant="secondary"
                        />
                      </div>
                      {latest.humanDecision.notes ? (
                        <div className="border-border/60 border-t pt-2">
                          <p className="text-muted-foreground text-xs font-medium">
                            {t("overrideReasonLabel")}
                          </p>
                          <p className="text-foreground text-xs">
                            {latest.humanDecision.notes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Override — a centered modal, not a growing inline form, so the
       * main workflow page stays uncluttered while reviewing. */}
      <Dialog open={overriding} onOpenChange={setOverriding}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("overrideDialogTitle")}</DialogTitle>
            <DialogDescription>{t("overrideDialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-0.5">
            {/* AI's raw suggestion, for reference while overriding — always
             * shown as-is (even if it didn't exactly match the live
             * methodology list below and so couldn't be pre-filled; see
             * startOverride). Distinct from "Your domain(s)" below, which is
             * what actually gets saved. */}
            <div className="bg-secondary/10 grid grid-cols-2 gap-3 rounded-lg p-2.5">
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium">
                  {t("suggestedDomains")}
                </p>
                <DomainChips items={latest?.suggestion.domains ?? []} variant="primary" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-[11px] font-medium">
                  {t("suggestedSubDomains")}
                </p>
                <DomainChips
                  items={latest?.suggestion.subDomains ?? []}
                  variant="secondary"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium">{t("editableLabel")}</p>
                <ChipEditor
                  values={overrideDomains}
                  onChange={setOverrideDomains}
                  options={domainNames}
                  loading={domainOptionsLoading}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium">{t("editableSubLabel")}</p>
                {overrideDomains.length === 0 ? (
                  <p className="text-muted-foreground border-input rounded-md border border-dashed px-3 py-2 text-xs">
                    {t("selectDomainFirst")}
                  </p>
                ) : (
                  <ChipEditor
                    values={overrideSubDomains}
                    onChange={setOverrideSubDomains}
                    options={subDomainNamesFor(overrideDomains)}
                    loading={domainOptionsLoading}
                  />
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{t("overrideSelectionNote")}</p>

            <div className="space-y-1.5">
              <label htmlFor="overrideReason" className="text-xs font-medium">
                {t("overrideReasonLabel")}
              </label>
              <textarea
                id="overrideReason"
                rows={3}
                required
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t("overrideReasonPlaceholder")}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverriding(false)}
              disabled={isReviewing}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => submitReview("modified")}
              disabled={isReviewing || overrideReason.trim().length === 0}
              className="gap-1.5"
            >
              {isReviewing ? <Loader2 className="size-4 animate-spin" /> : null}
              {isReviewing ? t("savingOverride") : t("saveOverride")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
