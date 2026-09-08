import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateInitiativePayload,
  Initiative,
  NeedAnalyticalStatusEvent,
  UpdateInitiativePayload,
} from "@/services/initiatives/initiatives.types";

export const initiativesService = {
  async list(): Promise<Initiative[]> {
    return apiClient.get<Initiative[]>(endpoints.initiatives.list);
  },
  async getById(id: string): Promise<Initiative> {
    return apiClient.get<Initiative>(endpoints.initiatives.byId(id));
  },
  async create(payload: CreateInitiativePayload): Promise<Initiative> {
    return apiClient.post<Initiative>(endpoints.initiatives.create, payload);
  },
  async update(id: string, payload: UpdateInitiativePayload): Promise<Initiative> {
    return apiClient.patch<Initiative>(endpoints.initiatives.update(id), payload);
  },
  async listLinkedByNeed(needId: string): Promise<Initiative[]> {
    return apiClient.get<Initiative[]>(endpoints.initiatives.linkedByNeed(needId));
  },
  async linkNeed(needId: string, initiativeId: string): Promise<void> {
    await apiClient.post(endpoints.initiatives.linkNeed(needId, initiativeId), {});
  },
  async unlinkNeed(needId: string, initiativeId: string): Promise<void> {
    await apiClient.patch(endpoints.initiatives.unlinkNeed(needId, initiativeId), {});
  },
  async statusHistory(needId: string): Promise<NeedAnalyticalStatusEvent[]> {
    return apiClient.get<NeedAnalyticalStatusEvent[]>(
      endpoints.initiatives.statusHistory(needId),
    );
  },
};
