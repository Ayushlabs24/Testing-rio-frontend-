import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateSurveyLinkPayload,
  PublicSurveyLink,
} from "@/services/public-surveys/public-surveys.types";

export const publicSurveysService = {
  async listLinks(needId: string): Promise<PublicSurveyLink[]> {
    return apiClient.get<PublicSurveyLink[]>(endpoints.publicSurveys.links(needId));
  },

  async createLink(
    needId: string,
    payload: CreateSurveyLinkPayload,
  ): Promise<PublicSurveyLink> {
    return apiClient.post<PublicSurveyLink>(
      endpoints.publicSurveys.links(needId),
      payload,
    );
  },

  async deactivateLink(needId: string, linkId: string): Promise<PublicSurveyLink> {
    return apiClient.patch<PublicSurveyLink>(
      endpoints.publicSurveys.deactivateLink(needId, linkId),
    );
  },
};
