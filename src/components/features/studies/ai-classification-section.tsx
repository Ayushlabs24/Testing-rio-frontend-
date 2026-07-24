"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  RotateCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import {
  aiDecisionsService,
  aiReviewService,
} from "@/services/ai-decisions/ai-decisions.service";
import type { AiDecision } from "@/services/ai-decisions/ai-decisions.types";
import { ApiError } from "@/services/api/types";
import { domainsService } from "@/services/domains/domains.service";
import { needsService } from "@/services/needs/needs.service";
import type { Need, NeedStatus } from "@/services/needs/needs.types";

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

const STATUS_BADGE_CLASS: Record<NeedStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_ai_classification: "bg-muted text-muted-foreground",
  evidence_submitted: "bg-muted text-muted-foreground",
  ai_classified: "bg-badge-primary text-badge-primary-foreground",
  ai_classification_failed: "bg-destructive/10 text-destructive",
  reviewer_approved: "bg-badge-success text-badge-success-foreground",
  survey_created: "bg-badge-success text-badge-success-foreground",
  survey_published: "bg-badge-success text-badge-success-foreground",
};

const POLL_INTERVAL_MS = 3000;

// AI Classification status + the Approver's Override/Approve/Reject actions,
// all in one place on the Need workspace page. Curating the suggested
// question list itself still happens on the existing Survey Builder page
// (reached via the button below) — this section only surfaces classification
// and the approve/reject decision, it doesn't duplicate the question editor.
export function AiClassificationSection({
  need,
  onNeedUpdated,
}: {
  need: Need;
  /** Fires whenever this section learns of a newer Need state — after a
   * manual Retry, a poll picking up classification completing, or an
   * Approve/Reject. */
  onNeedUpdated?: (need: Need) => void;
}) {
  const t = useTranslations("app.studies.classification");
  const canReview = usePermission("aiReview", "approve");

  const [latest, setLatest] = useState<AiDecision | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const previousStatusRef = useRef(need.status);
  // Guards the draft self-heal kick-off (below) to at most once per Need —
  // without this, a re-render while the kick-off's own request is still in
  // flight (status hasn't moved off "draft" yet) would fire it again.
  const draftKickedOffRef = useRef<string | null>(null);

  const [domainOptions, setDomainOptions] = useState<
    { name: string; subDomains: string[] }[]
  >([]);
  const [overriding, setOverriding] = useState(false);
  const [overrideDomain, setOverrideDomain] = useState<string | null>(null);
  const [overrideSubDomain, setOverrideSubDomain] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingOverride, setPendingOverride] = useState<{
    domain: string;
    subDomain: string;
    reason: string;
  } | null>(null);
  const [overridePreviewLoading, setOverridePreviewLoading] = useState(false);

  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comments, setComments] = useState("");
  const [commentsError, setCommentsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    aiDecisionsService
      .listByNeed(need.id)
      .then((list) => {
        if (!cancelled) setLatest(list[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [need.id, need.status]);

  // A rejected Need sits at `pending_ai_classification` too — same status
  // value a fresh Need starts at — but nothing is actually running here:
  // the last thing that happened is a human rejection, and the backend
  // deliberately does NOT re-classify until the Researcher actually edits
  // the Need and saves (see NeedsService.update()'s fire-and-forget
  // re-classification, gated on the patch actually changing something).
  // Showing the generic "in progress" spinner in this state is what read as
  // "rejecting immediately re-runs AI" — it doesn't, but looked like it did.
  const isAwaitingRevision =
    need.status === "pending_ai_classification" &&
    latest?.humanDecision?.decision === "rejected";

  const isReadyForReview = need.status === "ai_classified" && !latest?.humanDecision;
  const hasSurvey =
    isReadyForReview ||
    need.status === "reviewer_approved" ||
    need.status === "survey_created" ||
    need.status === "survey_published";

  useEffect(() => {
    domainsService
      .listWithSubDomains()
      .then((domains) =>
        setDomainOptions(
          domains
            .filter((d) => d.isActive)
            .map((d) => ({
              name: d.name,
              subDomains: d.subDomains.filter((sd) => sd.isActive).map((sd) => sd.name),
            })),
        ),
      )
      .catch(() => setDomainOptions([]));
  }, []);

  // Self-heal: a Need should never actually rest at the bare "draft"
  // default post-creation — that only happens if something created it
  // without going through the normal automatic-classification entry point
  // (e.g. a Need imported via file upload before NeedsImportService started
  // triggering it too). Rather than leaving it stuck forever with nothing
  // running, kick off classification the first time anyone views it here,
  // same as a fresh manually-created Need gets automatically.
  useEffect(() => {
    if (need.status !== "draft") return;
    if (draftKickedOffRef.current === need.id) return;
    draftKickedOffRef.current = need.id;
    aiDecisionsService.classify(need.id).catch(() => undefined);
  }, [need.id, need.status]);

  // Poll while classification is in flight (or about to be, for a "draft"
  // Need the effect above just kicked off) — no push mechanism exists, so
  // this is the only way the page learns it finished without a reload.
  useEffect(() => {
    if (isAwaitingRevision) return;
    if (need.status !== "pending_ai_classification" && need.status !== "draft") return;
    const interval = setInterval(() => {
      needsService
        .getById(need.id)
        .then((updated) => onNeedUpdated?.(updated))
        .catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need.id, need.status]);

  useEffect(() => {
    const wasInProgress =
      previousStatusRef.current === "pending_ai_classification" ||
      previousStatusRef.current === "draft";
    if (wasInProgress && need.status === "ai_classified") {
      setJustCompleted(true);
      const timer = setTimeout(() => setJustCompleted(false), 4000);
      return () => clearTimeout(timer);
    }
    previousStatusRef.current = need.status;
  }, [need.status]);

  const workingDomain = pendingOverride?.domain ?? need.aiSuggestedDomain ?? null;
  const workingSubDomain =
    pendingOverride?.subDomain ?? need.aiSuggestedSubDomain ?? null;
  const subDomainOptionsFor = (domain: string | null): string[] =>
    domainOptions.find((d) => d.name === domain)?.subDomains ?? [];

  async function retry() {
    setError(null);
    setRetrying(true);
    try {
      await aiDecisionsService.classify(need.id);
      const updated = await needsService.getById(need.id);
      onNeedUpdated?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("classifyError"));
    } finally {
      setRetrying(false);
    }
  }

  function startOverride() {
    setOverrideDomain(need.aiSuggestedDomain ?? null);
    setOverrideSubDomain(need.aiSuggestedSubDomain ?? null);
    setOverrideReason("");
    setOverriding(true);
  }

  async function previewOverride() {
    if (!overrideDomain || !overrideSubDomain || !overrideReason.trim()) return;
    setOverridePreviewLoading(true);
    setError(null);
    try {
      // Refreshes the suggested questions on the Survey Builder page for the
      // candidate domain — nothing is written to the Need until Approve.
      await aiReviewService.overrideDomainPreview(
        need.id,
        overrideDomain,
        overrideSubDomain,
      );
      setPendingOverride({
        domain: overrideDomain,
        subDomain: overrideSubDomain,
        reason: overrideReason.trim(),
      });
      setOverriding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("overrideError"));
    } finally {
      setOverridePreviewLoading(false);
    }
  }

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      // Approve only decides the classification here — curating questions,
      // picking a Methodology Version, and Submit for Approval / Approve &
      // Publish all happen separately on the Survey Builder page (see the
      // "View Suggested Questions" button below), once this Need reaches
      // reviewer_approved.
      await aiReviewService.approve(need.id, {
        domainOverride: pendingOverride ?? undefined,
      });
      const updated = await needsService.getById(need.id);
      onNeedUpdated?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("reviewError"));
    } finally {
      setApproving(false);
    }
  }

  function openRejectDialog() {
    setComments("");
    setCommentsError(null);
    setRejectOpen(true);
  }

  async function confirmReject() {
    const trimmed = comments.trim();
    if (!trimmed) {
      setCommentsError(t("commentsRequired"));
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      await aiReviewService.reject(need.id, trimmed);
      setRejectOpen(false);
      const updated = await needsService.getById(need.id);
      onNeedUpdated?.(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("reviewError"));
    } finally {
      setRejecting(false);
    }
  }

  const showPostApprovalSummary =
    need.status === "reviewer_approved" ||
    need.status === "survey_created" ||
    need.status === "survey_published" ||
    (need.status === "ai_classified" && Boolean(latest?.humanDecision));

  return (
    <div className="border-border overflow-hidden rounded-xl border">
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
            isAwaitingRevision
              ? "bg-destructive/10 text-destructive"
              : STATUS_BADGE_CLASS[need.status],
          )}
        >
          {isAwaitingRevision ? t("rejectedStatus") : t(`needStatus.${need.status}`)}
        </Badge>
      </div>

      <div className="space-y-4 p-5">
        {justCompleted ? (
          <div
            role="status"
            className="bg-badge-success/10 text-badge-success-foreground border-badge-success/30 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            {t("justCompleted")}
          </div>
        ) : null}

        {isAwaitingRevision ? (
          <div className="border-destructive/40 bg-destructive/5 flex items-start gap-2.5 rounded-md border p-3.5">
            <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="text-destructive text-sm font-medium">
                {t("reviewerCommentsLabel")}
              </p>
              {latest?.humanDecision?.notes ? (
                <p className="text-foreground text-sm whitespace-pre-wrap">
                  {latest.humanDecision.notes}
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">{t("awaitingRevisionHint")}</p>
            </div>
          </div>
        ) : need.status === "pending_ai_classification" || need.status === "draft" ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {t("pendingHint")}
          </div>
        ) : null}

        {need.status === "ai_classification_failed" ? (
          <div className="space-y-3">
            <div className="border-destructive/40 bg-destructive/5 flex items-start gap-2.5 rounded-md border p-3.5">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                <p className="text-destructive text-sm font-medium">{t("failedTitle")}</p>
                {need.classificationError ? (
                  <p className="text-foreground text-sm">{need.classificationError}</p>
                ) : null}
              </div>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <LoadingButton
              type="button"
              variant="outline"
              onClick={retry}
              isLoading={retrying}
              className="gap-1.5"
              startIcon={<RotateCw className="size-3.5" />}
              text={retrying ? t("retrying") : t("retry")}
            />
          </div>
        ) : null}

        {showPostApprovalSummary ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-badge-secondary/10 border-badge-secondary/30 space-y-2 rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("aiSuggestionHeading")}
              </p>
              <div className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium">
                  {t("aiSuggestedDomainLabel")}
                </p>
                <DomainChips
                  items={need.aiSuggestedDomain ? [need.aiSuggestedDomain] : []}
                  variant="secondary"
                  border
                />
              </div>
              {need.aiSuggestedSubDomain ? (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("aiSuggestedSubDomainLabel")}
                  </p>
                  <DomainChips
                    items={[need.aiSuggestedSubDomain]}
                    variant="secondary"
                    border
                  />
                </div>
              ) : null}
              {latest?.suggestion.rationale ? (
                <p className="text-foreground/80 text-xs leading-relaxed italic">
                  {latest.suggestion.rationale}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              {need.domain && need.subDomain ? (
                <div className="bg-badge-success/10 border-badge-success/30 flex items-start gap-2 rounded-lg border p-4">
                  <CheckCircle2 className="text-badge-success-foreground mt-0.5 size-4 shrink-0" />
                  <div className="w-full space-y-2">
                    <p className="text-badge-success-foreground text-xs font-semibold">
                      {t("approvedStatusTitle")}
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("approvedDomainLabel")}
                      </p>
                      <DomainChips items={[need.domain]} variant="primary" border />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("approvedSubDomainLabel")}
                      </p>
                      <DomainChips items={[need.subDomain]} variant="primary" border />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("approvedDomainLabel")}
                  </p>
                  <span className="text-muted-foreground text-sm">
                    {t("awaitingReview")}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {isReadyForReview ? (
          <>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
              {/* AI Suggestion — tinted panel, domain/sub-domain chips + the
                  rationale as an italicized explanation, matching the
                  reference design. */}
              <div className="bg-badge-secondary/10 border-badge-secondary/30 space-y-3 rounded-lg border p-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {t("aiSuggestionHeading")}
                </p>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("aiSuggestedDomainLabel")}
                  </p>
                  <DomainChips
                    items={need.aiSuggestedDomain ? [need.aiSuggestedDomain] : []}
                    variant="secondary"
                    border
                  />
                </div>
                {need.aiSuggestedSubDomain ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">
                      {t("aiSuggestedSubDomainLabel")}
                    </p>
                    <DomainChips
                      items={[need.aiSuggestedSubDomain]}
                      variant="secondary"
                      border
                    />
                  </div>
                ) : null}
                {latest?.suggestion.rationale ? (
                  <p className="text-foreground/80 text-xs leading-relaxed italic">
                    {latest.suggestion.rationale}
                  </p>
                ) : null}
              </div>

              {/* Confidence as an actual progress bar (tiered green/amber/
                  red), plus the Working Domain once an override is staged. */}
              <div className="space-y-4">
                {latest && latest.confidence > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {t("confidence")}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          latest.confidence >= 0.7
                            ? "text-success"
                            : latest.confidence >= 0.4
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {Math.round(latest.confidence * 100)}%
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          latest.confidence >= 0.7
                            ? "bg-success"
                            : latest.confidence >= 0.4
                              ? "bg-warning"
                              : "bg-destructive",
                        )}
                        style={{ width: `${Math.round(latest.confidence * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Working Domain only matters once an override is actually
                    staged — otherwise it's identical to AI Suggested Domain
                    above and just duplicates it. */}
                {pendingOverride ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">
                      {t("workingDomainLabel")}
                    </p>
                    <DomainChips
                      items={workingDomain ? [workingDomain] : []}
                      variant="primary"
                      border
                    />
                    {workingSubDomain ? (
                      <p className="text-muted-foreground text-xs">{workingSubDomain}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {canReview ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={startOverride}>
                  {t("override")}
                </Button>
                {pendingOverride ? (
                  <p className="text-muted-foreground text-xs">
                    {t("overridePendingNote")}
                  </p>
                ) : null}
              </div>
            ) : (
              // Researchers/other viewers can see the classification but the
              // Approve/Override/Reject decision is entirely the Reviewer/
              // Approver's job — this replaces those controls for them. A
              // `div` (block-level, own line) with no border/pill styling —
              // plain informational text, deliberately not shaped like the
              // "View Suggested Questions" button below so the two aren't
              // mistaken for a pair of equivalent actions.
              <div
                title={t("sentForApprovalTooltip")}
                className="text-muted-foreground flex items-center gap-1.5 text-xs"
              >
                <Info className="size-3.5 shrink-0" />
                {t("sentForApproval")}
              </div>
            )}
          </>
        ) : null}

        {hasSurvey ? (
          <div className="pt-2">
            <Button asChild size="sm" className="gap-2 font-medium">
              <Link href={`/survey-builder/${need.id}`}>
                <ClipboardList className="size-4" />
                Open Survey Builder (Build & Publish)
              </Link>
            </Button>
          </div>
        ) : null}

        {isReadyForReview && canReview ? (
          <div className="flex items-center justify-end gap-2.5 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={openRejectDialog}
              disabled={approving || rejecting}
            >
              <XCircle className="size-4" />
              {t("reject")}
            </Button>
            <LoadingButton
              type="button"
              isLoading={approving}
              onClick={approve}
              disabled={rejecting}
              className="gap-1.5"
              startIcon={<CheckCircle2 className="size-4" />}
              text={approving ? t("approving") : t("approve")}
            />
          </div>
        ) : null}
      </div>

      {/* Override Domain */}
      <Dialog open={overriding} onOpenChange={setOverriding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("overrideDialogTitle")}</DialogTitle>
            <DialogDescription>{t("overrideDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("domainLabel")}</Label>
              <Select
                value={overrideDomain ?? undefined}
                onValueChange={(v) => {
                  setOverrideDomain(v);
                  setOverrideSubDomain(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectDomain")} />
                </SelectTrigger>
                <SelectContent>
                  {domainOptions.map((d) => (
                    <SelectItem key={d.name} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("subDomainLabel")}</Label>
              <Select
                value={overrideSubDomain ?? undefined}
                onValueChange={setOverrideSubDomain}
                disabled={!overrideDomain}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectSubDomain")} />
                </SelectTrigger>
                <SelectContent>
                  {subDomainOptionsFor(overrideDomain).map((sd) => (
                    <SelectItem key={sd} value={sd}>
                      {sd}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="override-reason">{t("overrideReasonLabel")}</Label>
              <Textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t("overrideReasonPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOverriding(false)}
              disabled={overridePreviewLoading}
            >
              {t("cancel")}
            </Button>
            <LoadingButton
              type="button"
              onClick={previewOverride}
              disabled={!overrideDomain || !overrideSubDomain || !overrideReason.trim()}
              isLoading={overridePreviewLoading}
              text={overridePreviewLoading ? t("previewing") : t("previewOverride")}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => !rejecting && setRejectOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectDialogTitle")}</DialogTitle>
            <DialogDescription>{t("rejectDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-comments">
              {t("commentsLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-comments"
              rows={5}
              value={comments}
              onChange={(e) => {
                setComments(e.target.value);
                if (commentsError) setCommentsError(null);
              }}
              placeholder={t("commentsPlaceholder")}
              aria-invalid={commentsError ? true : undefined}
            />
            {commentsError ? (
              <p className="text-destructive text-sm">{commentsError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              {t("cancel")}
            </Button>
            <LoadingButton
              type="button"
              variant="destructive"
              isLoading={rejecting}
              onClick={confirmReject}
              text={rejecting ? t("rejecting") : t("confirmReject")}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
