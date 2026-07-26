import { apiClient } from "@/services/api/client";
import { apiConfig } from "@/services/api/config";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type {
  CreateSurveyLinkPayload,
  PublicSurveyLink,
  QuestionResponseListResult,
  SurveyResponseDetail,
  SurveyResponseExportFormat,
  SurveyResponseListResult,
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

  /** Sends the link plus its QR code (embedded, not just the raw URL) as a
   * real formatted email — a mailto: link has no way to attach an image, so
   * this goes through the backend's mailer instead (see
   * PublicSurveysService.shareLinkByEmail). The QR is generated fresh
   * server-side from the link's own token, not sent from here. */
  async shareLinkByEmail(needId: string, linkId: string, email: string): Promise<void> {
    await apiClient.post(endpoints.publicSurveys.shareLinkByEmail(needId, linkId), {
      email,
    });
  },

  async listResponses(
    needId: string,
    params: {
      surveyLinkId?: string;
      limit?: number;
      offset?: number;
      search?: string;
    } = {},
  ): Promise<SurveyResponseListResult> {
    return apiClient.get<SurveyResponseListResult>(
      endpoints.publicSurveys.responses(needId),
      { params },
    );
  },

  /** Same rows as `listResponses`, with each one's answers already joined
   * in — one call for a summary screen to build its own tallies from,
   * instead of one `getResponse` per row. */
  async listResponsesWithAnswers(
    needId: string,
    surveyLinkId?: string,
  ): Promise<SurveyResponseDetail[]> {
    return apiClient.get<SurveyResponseDetail[]>(
      endpoints.publicSurveys.responsesWithAnswers(needId),
      { params: { surveyLinkId } },
    );
  },

  async listQuestionResponses(
    needId: string,
    questionId: string,
    params: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<QuestionResponseListResult> {
    return apiClient.get<QuestionResponseListResult>(
      endpoints.publicSurveys.questionResponses(needId, questionId),
      { params },
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
