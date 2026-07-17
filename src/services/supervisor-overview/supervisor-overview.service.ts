import { apiClient } from "@/services/api/client";
import type { SupervisorOverview } from "@/services/supervisor-overview/supervisor-overview.types";

export const supervisorOverviewService = {
  async get(): Promise<SupervisorOverview> {
    return apiClient.get<SupervisorOverview>("/supervisor-overview");
  },
};
