import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { QuestionBankAlert } from "@/services/question-bank-alerts/question-bank-alerts.types";

export const questionBankAlertsService = {
  async listAlerts(): Promise<QuestionBankAlert[]> {
    return apiClient.get<QuestionBankAlert[]>(endpoints.questionBankAlerts.list);
  },
};
