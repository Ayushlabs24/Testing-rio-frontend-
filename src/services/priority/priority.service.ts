import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  PriorityDashboardEntry,
  PriorityScore,
  VillageComparisonEntry,
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
  // RIO-FR-005 (Q12) — `gapType` filters to Needs whose analyst-entered Gap
  // Type classification matches exactly.
  async listDashboard(gapType?: string): Promise<PriorityDashboardEntry[]> {
    return apiClient.get<PriorityDashboardEntry[]>(endpoints.priority.dashboard, {
      params: { gapType },
    });
  },
  /** RIO-FR-003 AC 5 — the reviewer replacing the computed number.
   *
   * The reason is not optional. The server refuses an empty one and the
   * database has a CHECK constraint behind that, so the UI disabling the
   * button is a courtesy, not the guard. */
  async override(
    id: string,
    overrideScore: number,
    reason: string,
  ): Promise<PriorityScore> {
    return apiClient.patch<PriorityScore>(endpoints.priority.override(id), {
      overrideScore,
      reason,
    });
  },
  // Human Review gate — a Priority Score never becomes publicly visible
  // (dashboard/reports) until a reviewer approves it here.
  async approve(id: string): Promise<PriorityScore> {
    return apiClient.patch<PriorityScore>(endpoints.priority.approve(id));
  },
  // RIO-FR-005 (Q9) — cross-study village comparison. Scope is enforced
  // server-side by role (NGO: own org's studies only; NCNP/Center
  // Supervisor: any org's studies), not by anything this call does.
  async compareVillages(studyIds: string[]): Promise<VillageComparisonEntry[]> {
    return apiClient.get<VillageComparisonEntry[]>(endpoints.priority.villageComparison, {
      params: { studyIds: studyIds.join(",") },
    });
  },
};
