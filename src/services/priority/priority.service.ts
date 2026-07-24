import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  PriorityDashboardEntry,
  PriorityScore,
} from "@/services/priority/priority.types";

export const priorityService = {
  async score(needId: string, surveyLinkId?: string): Promise<PriorityScore> {
    return apiClient.post<PriorityScore>(endpoints.priority.score(needId), undefined, {
      params: { surveyLinkId },
    });
  },
  async getLatest(needId: string, surveyLinkId?: string): Promise<PriorityScore | null> {
    return apiClient.get<PriorityScore | null>(endpoints.priority.score(needId), {
      params: { surveyLinkId },
    });
  },
  async listDashboard(): Promise<PriorityDashboardEntry[]> {
    return apiClient.get<PriorityDashboardEntry[]>(endpoints.priority.dashboard);
  },
  // Human Review gate — a Priority Score never becomes publicly visible
  // (dashboard/reports) until a reviewer approves it here.
  async approve(id: string): Promise<PriorityScore> {
    return apiClient.patch<PriorityScore>(endpoints.priority.approve(id));
  },
};
