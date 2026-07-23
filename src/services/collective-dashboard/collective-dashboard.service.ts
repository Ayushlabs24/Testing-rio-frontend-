import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { CollectiveDashboard } from "./collective-dashboard.types";

export const collectiveDashboardService = {
  async get(): Promise<CollectiveDashboard> {
    return apiClient.get<CollectiveDashboard>(endpoints.collectiveDashboard);
  },
};
