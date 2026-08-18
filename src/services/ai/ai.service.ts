import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";

export interface AiStatus {
  online: boolean;
}

export const aiService = {
  // System Admin Dashboard's "System Status" panel only — whether the AI
  // recommendation engine (Gemini) is configured, not a live health check.
  async getStatus(): Promise<AiStatus> {
    return apiClient.get<AiStatus>(endpoints.ai.status);
  },
};
