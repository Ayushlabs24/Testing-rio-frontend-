import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateSurveyLinkPayload,
  PublicSurveyLink,
} from "@/services/public-surveys/public-surveys.types";

export const publicSurveysService = {
  async listLinks(studyId: string): Promise<PublicSurveyLink[]> {
    return apiClient.get<PublicSurveyLink[]>(endpoints.publicSurveys.links(studyId));
  },

  async createLink(
    studyId: string,
    payload: CreateSurveyLinkPayload,
  ): Promise<PublicSurveyLink> {
    return apiClient.post<PublicSurveyLink>(
      endpoints.publicSurveys.links(studyId),
      payload,
    );
  },

  async deactivateLink(studyId: string, linkId: string): Promise<PublicSurveyLink> {
    return apiClient.patch<PublicSurveyLink>(
      endpoints.publicSurveys.deactivateLink(studyId, linkId),
    );
  },
};
