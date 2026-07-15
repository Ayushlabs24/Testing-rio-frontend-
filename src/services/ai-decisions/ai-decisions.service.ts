import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { AiDecision } from "@/services/ai-decisions/ai-decisions.types";

export const aiDecisionsService = {
  async classify(studyId: string): Promise<AiDecision> {
    return apiClient.post<AiDecision>(endpoints.aiDecisions.classify(studyId));
  },

  async listByStudy(studyId: string): Promise<AiDecision[]> {
    return apiClient.get<AiDecision[]>(endpoints.aiDecisions.forStudy(studyId));
  },
};
