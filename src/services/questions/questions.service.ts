import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  QuestionManagementItem,
  UpdateQuestionPayload,
} from "@/services/questions/questions.types";

/**
 * RIO-FR-012 (Q31, client-confirmed 2026-08-20) — Question Bank management.
 * Initiating a change (edit/deactivate/reactivate) is restricted server-side
 * to methodologyQuestionBank:write (System Admin/NCNP Admin only). Every
 * change creates a pending version that only takes effect for new surveys
 * once a Human Reviewer approves it (methodologyQuestionBank:approve).
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

  // RIO-FR-012 (Q31) — Human Reviewer only (methodologyQuestionBank:approve).
  async listPendingApprovals(): Promise<QuestionManagementItem[]> {
    return apiClient.get<QuestionManagementItem[]>(
      endpoints.questionBank.pendingApprovals,
    );
  },

  async approve(id: string): Promise<QuestionManagementItem> {
    return apiClient.patch<QuestionManagementItem>(endpoints.questionBank.approve(id));
  },

  async reject(id: string, reason: string): Promise<QuestionManagementItem> {
    return apiClient.patch<QuestionManagementItem>(endpoints.questionBank.reject(id), {
      reason,
    });
  },
};
