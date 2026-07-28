import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  AiDecision,
  DomainSubDomainPair,
  ReviewDecisionPayload,
} from "@/services/ai-decisions/ai-decisions.types";
import type { Survey } from "@/services/surveys/surveys.service";

// A real Gemini generateContent call routinely takes longer than the app-wide
// request timeout (see apiConfig.timeoutMs) — this only overrides it for the
// one call that actually needs it, not the default every other request gets.
// const CLASSIFY_TIMEOUT_MS = 60_000;

export const aiDecisionsService = {
  /** Now the Retry action for a Need whose automatic classification failed —
   * classification itself runs automatically right after Need creation. */
  async classify(needId: string): Promise<AiDecision> {
    return apiClient.post<AiDecision>(endpoints.aiDecisions.classify(needId));
  },

  async listByNeed(needId: string): Promise<AiDecision[]> {
    return apiClient.get<AiDecision[]>(endpoints.aiDecisions.forNeed(needId));
  },

  async review(id: string, payload: ReviewDecisionPayload): Promise<AiDecision> {
    return apiClient.patch<AiDecision>(endpoints.aiDecisions.review(id), payload);
  },
};

export interface AiReviewApprovePayload {
  domainOverride?: { pairs: DomainSubDomainPair[]; reason?: string };
}

/** The Approver's classification actions — Approve/Reject/Override/Retry,
 * all scoped to one Need. Approve only decides the classification (sets the
 * authoritative domain/subDomain) — it does not touch the survey's question
 * list or publish it; that happens separately on the Survey Builder page
 * once the Need reaches `reviewer_approved` (see
 * AiDecisionsService.approveAiReview on the backend). */
export const aiReviewService = {
  async approve(needId: string, payload: AiReviewApprovePayload): Promise<void> {
    await apiClient.post(endpoints.aiReview.approve(needId), payload);
  },

  async reject(needId: string, comments: string): Promise<void> {
    await apiClient.post(endpoints.aiReview.reject(needId), { comments });
  },

  /** Preview only — does not write domain/subDomain onto the Need. Returns
   * the refreshed Survey with questions regenerated (merged+deduped) across
   * every candidate pair. Does persist `pairs`/`reason` onto the Need's
   * proposedDomains/proposedReason (see backend's overrideDomainPreview),
   * so the staged proposal is visible to whoever reviews next, in any
   * session — not just this browser tab. */
  async overrideDomainPreview(
    needId: string,
    pairs: DomainSubDomainPair[],
    reason?: string,
  ): Promise<Survey> {
    return apiClient.post<Survey>(endpoints.aiReview.overrideDomain(needId), {
      pairs,
      // Omitted (not sent as "") when blank — the backend's `reason` field
      // is minLength:1 when present, so an empty string would fail
      // validation instead of just being treated as "no reason given".
      reason: reason || undefined,
    });
  },

  async retryClassification(needId: string): Promise<AiDecision> {
    return apiClient.post<AiDecision>(endpoints.aiReview.retry(needId));
  },

  /** Researcher-driven manual classification — only reachable while the
   * Need is `ai_classification_failed`. Unlike overrideDomainPreview, this
   * persists immediately (there's no AI suggestion to preview against) and
   * moves the Need straight to `reviewer_approved`, same as an Approver's
   * decision — see AiDecisionsService.manualClassify on the backend. Only
   * honors a single pair (the backend method itself is effectively
   * unreachable via the automatic path now — see that method's own
   * comment). */
  async manualClassify(needId: string, domain: string, subDomain: string): Promise<void> {
    await apiClient.post(endpoints.aiReview.manualClassify(needId), {
      pairs: [{ domain, subDomain }],
    });
  },
};
