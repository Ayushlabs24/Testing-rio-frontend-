import { apiClient } from "@/services/api/client";
import { apiConfig } from "@/services/api/config";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type {
  CreateSurveyLinkPayload,
  PublicSurveyLink,
  SurveyResponseDetail,
  SurveyResponseExportFormat,
  SurveyResponseSummary,
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

  async listResponses(
    needId: string,
    surveyLinkId?: string,
  ): Promise<SurveyResponseSummary[]> {
    return apiClient.get<SurveyResponseSummary[]>(
      endpoints.publicSurveys.responses(needId),
      {
        params: { surveyLinkId },
      },
    );
  },

  async getResponse(needId: string, responseId: string): Promise<SurveyResponseDetail> {
    return apiClient.get<SurveyResponseDetail>(
      endpoints.publicSurveys.response(needId, responseId),
    );
  },

  /**
   * Export returns a binary file, not JSON — bypasses apiClient (which
   * assumes a JSON response body) and triggers a real browser download from
   * the Blob response, same pattern as reportsService.download().
   */
  async exportResponses(
    needId: string,
    format: SurveyResponseExportFormat,
    surveyLinkId?: string,
  ): Promise<void> {
    const path = endpoints.publicSurveys.exportResponses(needId, format);
    const url = new URL(
      (surveyLinkId
        ? `${path}&surveyLinkId=${encodeURIComponent(surveyLinkId)}`
        : path
      ).replace(/^\//, ""),
      `${apiConfig.baseUrl}/`,
    );
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => undefined);
      throw new ApiError({
        message: payload?.error?.message ?? response.statusText,
        status: response.status,
      });
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/.exec(disposition);
    const filename =
      filenameMatch?.[1] ?? `survey-responses.${format === "excel" ? "xlsx" : "csv"}`;

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
