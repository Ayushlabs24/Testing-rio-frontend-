import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type {
  CreateNeedPayload,
  Need,
  UpdateNeedPayload,
} from "@/services/needs/needs.types";

export const needsService = {
  async getByStudy(studyId: string): Promise<Need | null> {
    try {
      return await apiClient.get<Need>(endpoints.needs.forStudy(studyId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async create(studyId: string, payload: CreateNeedPayload): Promise<Need> {
    return apiClient.post<Need>(endpoints.needs.forStudy(studyId), payload);
  },

  async update(studyId: string, payload: UpdateNeedPayload): Promise<Need> {
    return apiClient.patch<Need>(endpoints.needs.forStudy(studyId), payload);
  },
};
