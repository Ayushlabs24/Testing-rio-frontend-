import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  MethodologyConfig,
  UpdateMethodologyConfigPayload,
} from "@/services/methodology-config/methodology-config.types";

export const methodologyConfigService = {
  async get(): Promise<MethodologyConfig> {
    return apiClient.get<MethodologyConfig>(endpoints.methodologyConfig.get);
  },
  async update(payload: UpdateMethodologyConfigPayload): Promise<MethodologyConfig> {
    return apiClient.patch<MethodologyConfig>(endpoints.methodologyConfig.get, payload);
  },
  async publish(): Promise<MethodologyConfig> {
    return apiClient.post<MethodologyConfig>(endpoints.methodologyConfig.publish);
  },
};
