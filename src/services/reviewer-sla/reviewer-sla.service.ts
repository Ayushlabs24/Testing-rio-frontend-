import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { SlaAlert, SlaConfig } from "@/services/reviewer-sla/reviewer-sla.types";

export const reviewerSlaService = {
  async getConfig(): Promise<SlaConfig> {
    return apiClient.get<SlaConfig>(endpoints.reviewerSla.config);
  },
  async listAlerts(): Promise<SlaAlert[]> {
    return apiClient.get<SlaAlert[]>(endpoints.reviewerSla.alerts);
  },
};
