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
import { DomainChips } from "@/components/common/domain-chips";
import { LoadingButton } from "@/components/common/loading-button";
import { MultiSelect } from "@/components/ui/multi-select";
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
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import {
  aiDecisionsService,
  aiReviewService,
} from "@/services/ai-decisions/ai-decisions.service";
import type {
  AiDecision,
  DomainSubDomainPair,
} from "@/services/ai-decisions/ai-decisions.types";
import { ApiError } from "@/services/api/types";
import { domainsService } from "@/services/domains/domains.service";
import { needsService } from "@/services/needs/needs.service";
import type { Need, NeedStatus } from "@/services/needs/needs.types";

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

// The staged Override (pairs + reason) lives only in this component's local
// state — nothing is written to the Need until Approve, by design (a
// browser refresh mid-override must never half-decide the Need). But
// "View Suggested Questions" navigates to a whole separate route (Survey
// Builder) to let the Approver inspect the questions that preview just
// regenerated, which unmounts this component and previously lost the
// staged selection entirely on the way back. sessionStorage survives that
// round trip without persisting anything server-side — it's still just a
// draft, gone entirely on tab close, and never treated as authoritative.
function pendingOverrideStorageKey(needId: string): string {
  return `rio:pending-override:${needId}`;
}

function readStoredPendingOverride(
  needId: string,
): { pairs: DomainSubDomainPair[]; reason: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(pendingOverrideStorageKey(needId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { pairs?: unknown }).pairs) &&
      typeof (parsed as { reason?: unknown }).reason === "string"
    ) {
      return parsed as { pairs: DomainSubDomainPair[]; reason: string };
    }
  } catch {
    // Malformed/foreign sessionStorage value — treat as no staged override.
  }
  return null;
}

function writeStoredPendingOverride(
  needId: string,
  value: { pairs: DomainSubDomainPair[]; reason: string } | null,
): void {
  if (typeof window === "undefined") return;
  const key = pendingOverrideStorageKey(needId);
  if (value) {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } else {
    window.sessionStorage.removeItem(key);
  }
}

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
  const { session } = useAuth();
  // Both role_ngo_research_officer and role_human_reviewer hold
  // aiReview:approve now (full parity — see role-matrix.ts), but the
  // Approve/Reject buttons specifically stay hidden for the Researcher on
  // this panel — a UI-only restriction, not a permission change. Override
  // still shows for both (Researcher can stage a candidate domain change),
  // just not the button that actually commits/rejects the decision.
  const canApproveReject = canReview && session?.role.key !== "ngo_research_officer";
  const router = useRouter();

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
  // Multi-select dropdown for Domains, no limit on how many. Each selected
  // Domain gets its own Sub-domain multi-select dropdown below it, keyed by
  // domain name — a Need can span multiple Sub-domains within one Domain.
  const [overrideDomains, setOverrideDomains] = useState<string[]>([]);
  const [overrideSubDomainsByDomain, setOverrideSubDomainsByDomain] = useState<
    Record<string, string[]>
  >({});
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingOverride, setPendingOverride] = useState<{
    pairs: DomainSubDomainPair[];
    reason: string;
  } | null>(() => readStoredPendingOverride(need.id));
  const [overridePreviewLoading, setOverridePreviewLoading] = useState(false);

  // Keep sessionStorage in sync with whatever's actually staged, so the
  // round trip to Survey Builder's "View Suggested Questions" and back
  // doesn't lose it (see readStoredPendingOverride's own comment above).
  useEffect(() => {
    writeStoredPendingOverride(need.id, pendingOverride);
  }, [need.id, pendingOverride]);

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

  // Deduped — a staged override can carry several sub-domains under the
  // same domain, and each domain/sub-domain should only appear once here.
  const workingDomains = pendingOverride
    ? [...new Set(pendingOverride.pairs.map((p) => p.domain))]
    : [];
  const workingSubDomains = pendingOverride
    ? [...new Set(pendingOverride.pairs.map((p) => p.subDomain))]
    : [];
  const workingSubDomainGroups = pendingOverride
    ? Object.entries(
        pendingOverride.pairs.reduce(
          (acc, { domain, subDomain }) => {
            const set = acc[domain] ?? new Set<string>();
            set.add(subDomain);
            acc[domain] = set;
            return acc;
          },
          {} as Record<string, Set<string>>,
        ),
      )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([domain, subDomains]) => ({
          domain,
          subDomains: [...subDomains].sort((a, b) => a.localeCompare(b)),
        }))
    : [];
  // The real, multi-valued Approved classification once one exists (see
  // NeedDomain on the backend) — falls back to the single domain/subDomain
  // columns for a Need reviewed before this existed.
  const approvedDomains =
    need.needDomains.length > 0
      ? [...new Set(need.needDomains.map((d) => d.domain))]
      : need.domain
        ? [need.domain]
        : [];
  const approvedSubDomains =
    need.needDomains.length > 0
      ? [...new Set(need.needDomains.map((d) => d.subDomain))]
      : need.subDomain
        ? [need.subDomain]
        : [];

  const subDomainOptionsFor = (domain: string): string[] =>
    domainOptions.find((d) => d.name === domain)?.subDomains ?? [];

  function pairsFromSelections(): DomainSubDomainPair[] {
    return overrideDomains.flatMap((domain) =>
      (overrideSubDomainsByDomain[domain] ?? []).map((subDomain) => ({
        domain,
        subDomain,
      })),
    );
  }

  // A stack of one Sub-domain dropdown per selected Domain grows the dialog
  // past the screen once several Domains are picked (e.g. the
  // allDomainsSelected case, which pre-selects all of them) — so every
  // selected Domain's Sub-domains are combined into ONE multi-select
  // instead, grouped by Domain (MultiSelect's `group` option). JSON-encode
  // [domain, subDomain] as the option value rather than a joined string, so
  // a "::"-style separator can never collide with a real Domain/Sub-domain
  // name.
  function subDomainOptionValue(domain: string, subDomain: string): string {
    return JSON.stringify([domain, subDomain]);
  }

  function parseSubDomainOptionValue(value: string): [string, string] {
    return JSON.parse(value) as [string, string];
  }

  const subDomainOptions = overrideDomains.flatMap((domain) =>
    subDomainOptionsFor(domain).map((subDomain) => ({
      value: subDomainOptionValue(domain, subDomain),
      label: subDomain,
      group: domain,
    })),
  );
  const subDomainSelectedValues = overrideDomains.flatMap((domain) =>
    (overrideSubDomainsByDomain[domain] ?? []).map((subDomain) =>
      subDomainOptionValue(domain, subDomain),
    ),
  );

  function handleSubDomainSelectionChange(next: string[]) {
    const byDomain: Record<string, string[]> = {};
    for (const domain of overrideDomains) byDomain[domain] = [];
    for (const raw of next) {
      const [domain, subDomain] = parseSubDomainOptionValue(raw);
      byDomain[domain] = [...(byDomain[domain] ?? []), subDomain];
    }
    setOverrideSubDomainsByDomain(byDomain);
  }

  // Dropping a Domain from the multi-select drops its staged Sub-domains
  // too — otherwise they'd linger invisibly and still count toward the
  // final pairs list.
  function handleOverrideDomainsChange(next: string[]) {
    setOverrideDomains(next);
    setOverrideSubDomainsByDomain((prev) => {
      const nextMap: Record<string, string[]> = {};
      for (const domain of next) nextMap[domain] = prev[domain] ?? [];
      return nextMap;
    });
  }

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
    // Seed the dropdowns from whatever's already known: the real,
    // multi-valued NeedDomain pairs if any exist; else, when AI couldn't
    // classify at all (allDomainsSelected), every active Domain/Sub-domain
    // is already implicitly in scope — so pre-select all of them, matching
    // what "All Domains" actually means, rather than opening the dialog
    // empty; else fall back to the AI's own single suggested pair.
    const initial: Record<string, string[]> = {};
    if (need.needDomains.length > 0) {
      for (const pair of need.needDomains) {
        initial[pair.domain] = [...(initial[pair.domain] ?? []), pair.subDomain];
      }
    } else if (need.allDomainsSelected) {
      for (const d of domainOptions) {
        initial[d.name] = [...d.subDomains];
      }
    } else if (need.aiSuggestedDomain && need.aiSuggestedSubDomain) {
      initial[need.aiSuggestedDomain] = [need.aiSuggestedSubDomain];
    }
    setOverrideDomains(Object.keys(initial));
    setOverrideSubDomainsByDomain(initial);
    setOverrideReason("");
    setOverriding(true);
  }

  async function previewOverride() {
    const pairs = pairsFromSelections();
    if (pairs.length === 0 || !overrideReason.trim()) return;
    setOverridePreviewLoading(true);
    setError(null);
    try {
      // Refreshes the suggested questions on the Survey Builder page for the
      // candidate pairs — nothing is written to the Need until Approve.
      await aiReviewService.overrideDomainPreview(need.id, pairs);
      setPendingOverride({
        pairs,
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
      // Committed — the staged draft (and its sessionStorage backup) no
      // longer applies to whatever the Need's state is from here on.
      setPendingOverride(null);
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
      // The Need resets to pending_ai_classification for fresh re-
      // classification — whatever was staged against the now-superseded
      // classification no longer applies.
      setPendingOverride(null);
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
            <div className="flex flex-wrap items-center gap-2">
              <LoadingButton
                type="button"
                variant="outline"
                onClick={retry}
                isLoading={retrying}
                className="gap-1.5"
                startIcon={<RotateCw className="size-3.5" />}
                text={retrying ? t("retrying") : t("retry")}
              />
              {/* The only way off ai_classification_failed besides Retry —
                  links straight to Survey Builder's manual-classification
                  gate (see that page), which shows every Domain, then its
                  Sub-domains, then the usual Question Bank flow once picked. */}
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/survey-builder/${need.id}`}>
                  <ClipboardList className="size-4" />
                  {t("classifyManually")}
                </Link>
              </Button>
            </div>
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
                  items={
                    need.allDomainsSelected
                      ? [t("allDomainsChip")]
                      : need.aiSuggestedDomain
                        ? [need.aiSuggestedDomain]
                        : []
                  }
                  variant="secondary"
                  border
                />
              </div>
              {need.allDomainsSelected || need.aiSuggestedSubDomain ? (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("aiSuggestedSubDomainLabel")}
                  </p>
                  <DomainChips
                    items={
                      need.allDomainsSelected
                        ? [t("allSubDomainsChip")]
                        : [need.aiSuggestedSubDomain!]
                    }
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
              {approvedDomains.length > 0 ? (
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
                      <DomainChips items={approvedDomains} variant="primary" border />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("approvedSubDomainLabel")}
                      </p>
                      <DomainChips items={approvedSubDomains} variant="primary" border />
                    </div>
                  </div>
                </div>
              ) : need.allDomainsSelected ? (
                // Approved as-is with no override — every active Domain/
                // Sub-domain stays implicitly in scope, same "All Domains"
                // framing as the AI Suggestion panel above.
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
                      <DomainChips
                        items={[t("allDomainsChip")]}
                        variant="primary"
                        border
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("approvedSubDomainLabel")}
                      </p>
                      <DomainChips
                        items={[t("allSubDomainsChip")]}
                        variant="primary"
                        border
                      />
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
                    items={
                      need.allDomainsSelected
                        ? [t("allDomainsChip")]
                        : need.aiSuggestedDomain
                          ? [need.aiSuggestedDomain]
                          : []
                    }
                    variant="secondary"
                    border
                  />
                </div>
                {need.allDomainsSelected || need.aiSuggestedSubDomain ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">
                      {t("aiSuggestedSubDomainLabel")}
                    </p>
                    <DomainChips
                      items={
                        need.allDomainsSelected
                          ? [t("allSubDomainsChip")]
                          : [need.aiSuggestedSubDomain!]
                      }
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
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("workingDomainLabel")}
                      </p>
                      <DomainChips
                        items={workingDomains}
                        variant="primary"
                        border
                        expandDialogTitle={t("workingDomainLabel")}
                        expandDialogContent={
                          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            {workingDomains.map((domain) => (
                              <li key={domain} className="text-foreground">
                                {domain}
                              </li>
                            ))}
                          </ul>
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("workingSubDomainLabel")}
                      </p>
                      <DomainChips
                        items={workingSubDomains}
                        variant="primary"
                        border
                        expandDialogTitle={t("workingSubDomainLabel")}
                        expandDialogContent={
                          <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
                            {workingSubDomainGroups.map(({ domain, subDomains }) => (
                              <div key={domain} className="space-y-1.5">
                                <p className="text-muted-foreground text-xs font-semibold">
                                  {domain}
                                </p>
                                <ul className="space-y-1 text-sm">
                                  {subDomains.map((subDomain) => (
                                    <li key={subDomain} className="text-foreground">
                                      {subDomain}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {canReview ? (
              <div className="space-y-3 border-t pt-4">
                {/* Match the review hierarchy from the reference: the broad
                    Override action leads the row, while Suggested Questions
                    stays beside it as the narrower navigation action. */}
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex-1"
                    onClick={startOverride}
                  >
                    {t("override")}
                  </Button>
                  {hasSurvey ? (
                    <Button
                      type="button"
                      className="w-full flex-1 gap-2 font-medium"
                      onClick={() => router.push(`/survey-builder/${need.id}`)}
                    >
                      <ClipboardList className="size-4" />
                      {isReadyForReview
                        ? t("viewSuggestedQuestions")
                        : t("openSurveyBuilder")}
                    </Button>
                  ) : null}
                </div>

                {pendingOverride ? (
                  <p className="text-muted-foreground text-xs">
                    {/* The Researcher can stage an Override but has no
                        Approve button on this panel (see canApproveReject)
                        — telling them it's "saved only when you Approve"
                        would be misleading, since they can't be the one to
                        do that. */}
                    {canApproveReject
                      ? t("overridePendingNote")
                      : t("overridePendingNoteResearcher")}
                  </p>
                ) : null}

                {canApproveReject ? (
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive w-full flex-1 gap-1.5"
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
                      className="w-full flex-1 gap-1.5"
                      startIcon={<CheckCircle2 className="size-4" />}
                      text={approving ? t("approving") : t("approve")}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              // Researchers/other viewers can see the classification but the
              // Approve/Override/Reject decision is entirely the Reviewer/
              // Approver's job — this replaces those controls for them.
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

        {hasSurvey && !canReview ? (
          <div className="pt-2">
            <Button asChild size="sm" className="gap-2 font-medium">
              <Link href={`/survey-builder/${need.id}`}>
                <ClipboardList className="size-4" />
                {isReadyForReview ? t("viewSuggestedQuestions") : t("openSurveyBuilder")}
              </Link>
            </Button>
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
              <MultiSelect
                options={domainOptions.map((d) => ({ value: d.name, label: d.name }))}
                values={overrideDomains}
                onChange={handleOverrideDomainsChange}
                placeholder={t("selectDomain")}
                searchPlaceholder={t("searchDomain")}
                emptyText={t("noDomainsFound")}
                removeAriaLabel={(domain) => t("removeDomainAria", { domain })}
              />
            </div>
            {/* One combined Sub-domain multi-select across every selected
                Domain, grouped by Domain — a stack of one dropdown per
                Domain pushed the dialog past the screen once several were
                selected (e.g. the allDomainsSelected case, which
                pre-selects all of them). */}
            {overrideDomains.length > 0 ? (
              <div className="space-y-1.5">
                <Label>{t("subDomainLabel")}</Label>
                <MultiSelect
                  options={subDomainOptions}
                  values={subDomainSelectedValues}
                  onChange={handleSubDomainSelectionChange}
                  placeholder={t("selectSubDomain")}
                  searchPlaceholder={t("searchSubDomain")}
                  emptyText={t("noSubDomainsFound")}
                  removeAriaLabel={(subDomain) => t("removeSubDomainAria", { subDomain })}
                />
              </div>
            ) : null}
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
              disabled={pairsFromSelections().length === 0 || !overrideReason.trim()}
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
