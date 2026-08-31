import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { RequestOptions } from "@/services/api/types";
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
  async classify(needId: string, options?: RequestOptions): Promise<AiDecision> {
    return apiClient.post<AiDecision>(
      endpoints.aiDecisions.classify(needId),
      undefined,
      options,
    );
  },

  async listByNeed(needId: string, options?: RequestOptions): Promise<AiDecision[]> {
    return apiClient.get<AiDecision[]>(endpoints.aiDecisions.forNeed(needId), options);
  },

  async review(id: string, payload: ReviewDecisionPayload): Promise<AiDecision> {
    return apiClient.patch<AiDecision>(endpoints.aiDecisions.review(id), payload);
  },
};

export interface AiReviewApprovePayload {
  domainOverride?: { pairs: DomainSubDomainPair[]; reason: string };
}

/** The Approver's classification actions — Approve/Reject/Override/Retry,
 * all scoped to one Need. Approve only decides the classification (sets the
 * authoritative domain/subDomain) — it does not touch the survey's question
 * list or publish it; that happens separately on the Survey Builder page
 * once the Need reaches `reviewer_approved` (see
 * AiDecisionsService.approveAiReview on the backend). */
export const aiReviewService = {
  async approve(
    needId: string,
    payload: AiReviewApprovePayload,
    options?: RequestOptions,
  ): Promise<void> {
    await apiClient.post(endpoints.aiReview.approve(needId), payload, options);
  },

  async reject(
    needId: string,
    comments: string,
    options?: RequestOptions,
  ): Promise<void> {
    await apiClient.post(endpoints.aiReview.reject(needId), { comments }, options);
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
    reason: string,
    options?: RequestOptions,
  ): Promise<Survey> {
    return apiClient.post<Survey>(
      endpoints.aiReview.overrideDomain(needId),
      { pairs, reason },
      options,
    );
  },

  async retryClassification(
    needId: string,
    options?: RequestOptions,
  ): Promise<AiDecision> {
    return apiClient.post<AiDecision>(
      endpoints.aiReview.retry(needId),
      undefined,
      options,
    );
  },

  /** Researcher-driven manual classification — only reachable while the
   * Need is `ai_classification_failed`. Unlike overrideDomainPreview, this
   * persists immediately (there's no AI suggestion to preview against) and
   * moves the Need straight to `reviewer_approved`, same as an Approver's
   * decision — see AiDecisionsService.manualClassify on the backend. Only
   * honors a single pair (the backend method itself is effectively
   * unreachable via the automatic path now — see that method's own
   * comment).
   *
   * `reason` is required by the backend's shared AiReviewOverrideDomainBody
   * schema (same one overrideDomainPreview uses) — this call used to omit
   * it entirely, so every manual classification 400'd with a validation
   * error and the whole "AI could not classify this need" recovery path
   * was completely unusable. */
  async manualClassify(
    needId: string,
    domain: string,
    subDomain: string,
    reason: string,
    options?: RequestOptions,
  ): Promise<void> {
    await apiClient.post(
      endpoints.aiReview.manualClassify(needId),
      { pairs: [{ domain, subDomain }], reason },
      options,
    );
  },
};
