import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  AiDecision,
  ReviewDecisionPayload,
} from "@/services/ai-decisions/ai-decisions.types";

// A real Gemini generateContent call routinely takes longer than the app-wide
// request timeout (see apiConfig.timeoutMs) — this only overrides it for the
// one call that actually needs it, not the default every other request gets.
const CLASSIFY_TIMEOUT_MS = 60_000;

export const aiDecisionsService = {
  async classify(studyId: string): Promise<AiDecision> {
    return apiClient.post<AiDecision>(
      endpoints.aiDecisions.classify(studyId),
      undefined,
      {
        timeoutMs: CLASSIFY_TIMEOUT_MS,
      },
    );
  },

  async listByStudy(studyId: string): Promise<AiDecision[]> {
    return apiClient.get<AiDecision[]>(endpoints.aiDecisions.forStudy(studyId));
  },

  async review(id: string, payload: ReviewDecisionPayload): Promise<AiDecision> {
    return apiClient.patch<AiDecision>(endpoints.aiDecisions.review(id), payload);
  },
};
