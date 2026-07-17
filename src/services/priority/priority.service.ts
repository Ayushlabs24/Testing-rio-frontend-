import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  PriorityDashboardEntry,
  PriorityScore,
} from "@/services/priority/priority.types";

export const priorityService = {
  async score(studyId: string, surveyLinkId?: string): Promise<PriorityScore> {
    return apiClient.post<PriorityScore>(endpoints.priority.score(studyId), undefined, {
      params: { surveyLinkId },
    });
  },
  async getLatest(studyId: string, surveyLinkId?: string): Promise<PriorityScore | null> {
    return apiClient.get<PriorityScore | null>(endpoints.priority.score(studyId), {
      params: { surveyLinkId },
    });
  },
  async listDashboard(): Promise<PriorityDashboardEntry[]> {
    return apiClient.get<PriorityDashboardEntry[]>(endpoints.priority.dashboard);
  },
};
