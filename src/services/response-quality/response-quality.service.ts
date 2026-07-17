import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  AiSummary,
  ResponseQualityResult,
} from "@/services/response-quality/response-quality.types";

export const responseQualityService = {
  async assess(studyId: string, surveyLinkId?: string): Promise<ResponseQualityResult[]> {
    return apiClient.post<ResponseQualityResult[]>(
      endpoints.responseQuality.assess(studyId),
      undefined,
      {
        params: { surveyLinkId },
      },
    );
  },
  async list(studyId: string, surveyLinkId?: string): Promise<ResponseQualityResult[]> {
    return apiClient.get<ResponseQualityResult[]>(
      endpoints.responseQuality.list(studyId),
      {
        params: { surveyLinkId },
      },
    );
  },
  async generateSummary(studyId: string, surveyLinkId?: string): Promise<AiSummary> {
    return apiClient.post<AiSummary>(
      endpoints.responseQuality.generateSummary(studyId),
      undefined,
      {
        params: { surveyLinkId },
      },
    );
  },
  async getSummary(studyId: string, surveyLinkId?: string): Promise<AiSummary | null> {
    return apiClient.get<AiSummary | null>(
      endpoints.responseQuality.getSummary(studyId),
      {
        params: { surveyLinkId },
      },
    );
  },
};
