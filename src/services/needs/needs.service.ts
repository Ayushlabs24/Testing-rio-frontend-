import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type { Need } from "@/services/needs/needs.types";

// Read-only from this app's side — Need Entry itself is Karthik's screen.
// This exists so other screens (Evidence Upload's AI Classification gate)
// can check "has the need been captured yet?" without owning that flow.
export const needsService = {
  async getByStudy(studyId: string): Promise<Need | null> {
    try {
      return await apiClient.get<Need>(endpoints.needs.forStudy(studyId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};
