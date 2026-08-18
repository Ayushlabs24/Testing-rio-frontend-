import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  QuestionManagementItem,
  UpdateQuestionPayload,
} from "@/services/questions/questions.types";

/**
 * RIO-FR-012 — Question Bank management (edit/deactivate/reactivate).
 * Reads and writes are both restricted server-side to surveyBuilder:write
 * (NGO Admin, Research Officer, Field Researcher, Human Reviewer, System
 * Admin) — the same roles that already curate a survey's own question
 * list, per the story's own default-behaviour note pending the client's
 * answer on exactly who should manage the bank.
 */
export const questionsService = {
  /** Every question in scope for management — unlike the Survey Builder's
   * own `surveysService.getQuestions`, this includes deactivated ones so
   * they can be found and reactivated. */
  async list(methodologyVersion?: string): Promise<QuestionManagementItem[]> {
    return apiClient.get<QuestionManagementItem[]>(endpoints.questionBank.manage, {
      params: methodologyVersion ? { methodologyVersion } : undefined,
    });
  },

  async update(
    id: string,
    payload: UpdateQuestionPayload,
  ): Promise<QuestionManagementItem> {
    return apiClient.patch<QuestionManagementItem>(
      endpoints.questionBank.byId(id),
      payload,
    );
  },

  async deactivate(id: string): Promise<QuestionManagementItem> {
    return apiClient.patch<QuestionManagementItem>(endpoints.questionBank.deactivate(id));
  },

  async reactivate(id: string): Promise<QuestionManagementItem> {
    return apiClient.patch<QuestionManagementItem>(endpoints.questionBank.reactivate(id));
  },
};
