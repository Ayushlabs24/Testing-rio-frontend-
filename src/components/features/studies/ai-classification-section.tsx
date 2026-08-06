"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  RotateCw,
  Sparkles,
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
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

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

// AI Classification status + staging a Domain Override, on the Need
// workspace page. The actual Approve/Reject decision — and curating the
// suggested question list — both happen on the Survey Builder page now (its
// "Approve & Publish" reads back whatever Override is staged here via
// Need.proposedDomains/proposedReason — see AiDecisionsService.
// overrideDomainPreview — visible across sessions, not just this browser
// tab), so an Approver has just one place to Override, curate questions,
// and Approve & Publish or Reject, instead of two disconnected screens/actions.
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
  const [overridePreviewLoading, setOverridePreviewLoading] = useState(false);

  // A staged (not-yet-decided) Override, read straight off the Need itself
  // (Need.proposedDomains/proposedReason — see schema.prisma) rather than
  // sessionStorage, so it's visible to whoever's viewing this Need next,
  // regardless of session/device — not just the browser tab that staged it.
  const pendingOverride =
    need.proposedDomains && need.proposedDomains.length > 0
      ? { pairs: need.proposedDomains, reason: need.proposedReason ?? "" }
      : null;

  const [survey, setSurvey] = useState<Survey | null>(null);

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

  // Survey.status is tracked separately from Need.status — submitting a
  // survey for approval doesn't require the Need's own classification to be
  // Approved first (SurveysService.submitForApproval has no such check), so
  // a Researcher can reach SUBMITTED while still isReadyForReview here.
  // Staging/committing a domain Override at that point would move the
  // ground out from under a Survey already sitting in the Approver's queue
  // for content review — see overrideDisabledForResearcher below.
  useEffect(() => {
    let cancelled = false;
    surveysService
      .getSurveyByNeedId(need.id)
      .then((result) => {
        if (!cancelled) setSurvey(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [need.id, need.status]);

  // The Research Officer specifically loses the Override button once the
  // Survey they curated has been submitted for the Approver's review — an
  // Approver can still Override regardless (they're the one who'd action
  // the resulting refreshed questions anyway). Re-enabled the moment the
  // Approver rejects the Survey's content (with comments, via the Review
  // page) and it drops back to DRAFT.
  const overrideDisabledForResearcher =
    session?.role.key === "ngo_research_officer" && survey?.status === "SUBMITTED";

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
  // final pairs list. A newly-added Domain starts with every one of its
  // active Sub-domains pre-selected (same default allDomainsSelected
  // already gets elsewhere in this dialog) rather than none — leaving it
  // empty meant a Domain added here contributed zero pairs to
  // pairsFromSelections() until a Sub-domain was separately picked for it,
  // and nothing blocked Preview Override from silently succeeding without
  // it (the button only checks the *total* pairs list is non-empty), so it
  // looked like the override "did nothing" for that Domain.
  function handleOverrideDomainsChange(next: string[]) {
    setOverrideDomains(next);
    setOverrideSubDomainsByDomain((prev) => {
      const nextMap: Record<string, string[]> = {};
      for (const domain of next) {
        nextMap[domain] = prev[domain] ?? subDomainOptionsFor(domain);
      }
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
    // Seed the dropdowns from whatever's already known — a staged proposal
    // (pendingOverride, from Need.proposedDomains) takes priority over
    // everything else, so re-opening Override shows what was already staged
    // instead of reverting to the AI's original suggestion (which is what
    // happened before this read from the Need directly). Falls back to the
    // real, multi-valued NeedDomain pairs if any exist; else the AI's own
    // single suggested pair.
    //
    // Deliberately does NOT pre-select anything when AI couldn't classify
    // at all (allDomainsSelected) — every Domain/Sub-domain pre-checked
    // read as the system having already decided, when nothing had actually
    // been chosen (feedback from product review). This is a genuine first
    // classification, not an override of an AI decision — the dialog stays
    // empty and the person has to actually pick something (see the
    // AI-couldn't-classify notice rendered above the trigger button, and
    // its own button label below).
    const initial: Record<string, string[]> = {};
    if (pendingOverride) {
      for (const pair of pendingOverride.pairs) {
        initial[pair.domain] = [...(initial[pair.domain] ?? []), pair.subDomain];
      }
    } else if (need.needDomains.length > 0) {
      for (const pair of need.needDomains) {
        initial[pair.domain] = [...(initial[pair.domain] ?? []), pair.subDomain];
      }
    } else if (
      !need.allDomainsSelected &&
      need.aiSuggestedDomain &&
      need.aiSuggestedSubDomain
    ) {
      initial[need.aiSuggestedDomain] = [need.aiSuggestedSubDomain];
    }
    setOverrideDomains(Object.keys(initial));
    setOverrideSubDomainsByDomain(initial);
    setOverrideReason(pendingOverride?.reason ?? "");
    setOverriding(true);
  }

  async function previewOverride() {
    const pairs = pairsFromSelections();
    const reason = overrideReason.trim();
    if (pairs.length === 0 || reason.length === 0) return;
    setOverridePreviewLoading(true);
    setError(null);
    try {
      // Refreshes the suggested questions on the Survey Builder page for the
      // candidate pairs, AND persists {pairs, reason} onto the Need itself
      // (proposedDomains/proposedReason) — nothing is written to the
      // authoritative domain/subDomain until Approve, but the proposal is
      // now visible to whoever reviews next, in any session.
      await aiReviewService.overrideDomainPreview(need.id, pairs, reason);
      const updated = await needsService.getById(need.id);
      onNeedUpdated?.(updated);
      setOverriding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("overrideError"));
    } finally {
      setOverridePreviewLoading(false);
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
                <p
                  dir="auto"
                  className="text-foreground/80 text-xs leading-relaxed italic"
                >
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
                  <p
                    dir="auto"
                    className="text-foreground/80 text-xs leading-relaxed italic"
                  >
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
                {/* AI declined to guess at all (allDomainsSelected) — this
                    is a first classification, not a change to an existing
                    AI decision, so it gets its own notice + button wording
                    rather than looking like every Domain/Sub-domain was
                    already (confusingly) pre-selected for review. */}
                {need.allDomainsSelected ? (
                  <div className="border-badge-warning/40 bg-badge-warning/10 flex items-start gap-2.5 rounded-md border p-3.5">
                    <AlertTriangle className="text-badge-warning-foreground mt-0.5 size-4 shrink-0" />
                    <p className="text-badge-warning-foreground text-sm">
                      {t("allDomainsNotice")}
                    </p>
                  </div>
                ) : null}

                {/* Match the review hierarchy from the reference: the broad
                    Override action leads the row, while Suggested Questions
                    stays beside it as the narrower navigation action. */}
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex-1"
                    onClick={startOverride}
                    disabled={overrideDisabledForResearcher}
                    title={
                      overrideDisabledForResearcher
                        ? t("overrideDisabledSurveySubmitted")
                        : undefined
                    }
                  >
                    {need.allDomainsSelected ? t("chooseClassification") : t("override")}
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
                    {t("overridePendingNote")}
                  </p>
                ) : null}

                {overrideDisabledForResearcher ? (
                  <p className="text-muted-foreground text-xs">
                    {t("overrideDisabledSurveySubmitted")}
                  </p>
                ) : null}
              </div>
            ) : (
              // Viewers without aiReview:approve can see the classification,
              // but Override/Approve & Publish/Reject are entirely the
              // Reviewer/Approver's job, done on the Survey Builder page —
              // this replaces those controls for them here.
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
        <DialogContent className="sm:max-w-xl">
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
              <Label htmlFor="override-reason">
                {t("overrideReasonLabel")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t("overrideReasonPlaceholder")}
                required
                aria-invalid={overrideReason.trim().length === 0 ? true : undefined}
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
              disabled={
                pairsFromSelections().length === 0 || overrideReason.trim().length === 0
              }
              isLoading={overridePreviewLoading}
              text={overridePreviewLoading ? t("previewing") : t("previewOverride")}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
