import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  MethodologyConfig,
  MethodologyConfigHistoryEntry,
  MethodologyVersionOption,
  UpdateMethodologyConfigPayload,
} from "@/services/methodology-config/methodology-config.types";

export const methodologyConfigService = {
  async get(): Promise<MethodologyConfig> {
    return apiClient.get<MethodologyConfig>(endpoints.methodologyConfig.get);
  },
  async update(payload: UpdateMethodologyConfigPayload): Promise<MethodologyConfig> {
    return apiClient.patch<MethodologyConfig>(endpoints.methodologyConfig.get, payload);
  },
  // System Reviewer only — required before System Admin can publish.
  async approve(notes: string): Promise<MethodologyConfig> {
    return apiClient.patch<MethodologyConfig>(endpoints.methodologyConfig.approve, {
      notes,
    });
  },
  async reject(notes: string): Promise<MethodologyConfig> {
    return apiClient.patch<MethodologyConfig>(endpoints.methodologyConfig.reject, {
      notes,
    });
  },
  async publish(): Promise<MethodologyConfig> {
    return apiClient.post<MethodologyConfig>(endpoints.methodologyConfig.publish);
  },
  /** TEMPORARY — see MethodologyVersionOption's doc comment. */
  async listVersionOptions(): Promise<MethodologyVersionOption[]> {
    return apiClient.get<MethodologyVersionOption[]>(
      endpoints.methodologyConfig.versions,
    );
  },
  async getHistory(): Promise<MethodologyConfigHistoryEntry[]> {
    return apiClient.get<MethodologyConfigHistoryEntry[]>(
      endpoints.methodologyConfig.history,
    );
  },
};
