import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { RequestOptions } from "@/services/api/types";
import type {
  AiSummary,
  ResponseQualityResult,
} from "@/services/response-quality/response-quality.types";

export const responseQualityService = {
  async assess(needId: string, surveyLinkId?: string): Promise<ResponseQualityResult[]> {
    return apiClient.post<ResponseQualityResult[]>(
      endpoints.responseQuality.assess(needId),
      undefined,
      {
        params: { surveyLinkId },
      },
    );
  },
  async list(
    needId: string,
    surveyLinkId?: string,
    options?: RequestOptions,
  ): Promise<ResponseQualityResult[]> {
    return apiClient.get<ResponseQualityResult[]>(
      endpoints.responseQuality.list(needId),
      {
        ...options,
        params: { surveyLinkId },
      },
    );
  },
  async generateSummary(needId: string, surveyLinkId?: string): Promise<AiSummary> {
    return apiClient.post<AiSummary>(
      endpoints.responseQuality.generateSummary(needId),
      undefined,
      {
        params: { surveyLinkId },
      },
    );
  },
  async getSummary(needId: string, surveyLinkId?: string): Promise<AiSummary | null> {
    return apiClient.get<AiSummary | null>(endpoints.responseQuality.getSummary(needId), {
      params: { surveyLinkId },
    });
  },
};
