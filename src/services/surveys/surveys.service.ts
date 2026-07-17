import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";

export interface QuestionOption {
  domain: string;
  subDomain: string;
}

export interface Question {
  id: string;
  questionId: string;
  domain: string;
  subDomain: string;
  indicator?: string;
  kpi?: string;
  questionText: string;
  answerType: string;
  answerOptions?: string[] | null;
  requiredOptional: string;
}

export interface Survey {
  id: string;
  studyId: string;
  title: string;
  status: string;
  questions: Array<Question & { order: number; isRequired: boolean }>;
}

export const surveysService = {
  async getDomainOptions(): Promise<QuestionOption[]> {
    return apiClient.get<QuestionOption[]>(endpoints.questionBank.domainOptions);
  },

  async getQuestions(domain: string, subDomain: string): Promise<Question[]> {
    return apiClient.get<Question[]>(endpoints.questionBank.questions, {
      params: { domain, subDomain },
    });
  },

  async getSurveyByStudyId(studyId: string): Promise<Survey | null> {
    return apiClient.get<Survey | null>(endpoints.surveys.forStudy(studyId));
  },

  async recommendQuestions(studyId: string): Promise<Survey> {
    return apiClient.post<Survey>(endpoints.surveys.recommendQuestions(studyId));
  },

  async updateQuestions(
    surveyId: string,
    questions: Array<{ questionId: string; order: number; isRequired: boolean }>,
  ): Promise<{ success: boolean }> {
    return apiClient.patch<{ success: boolean }>(endpoints.surveys.updateQuestions(surveyId), {
      questions,
    });
  },

  async saveDraft(surveyId: string, status?: string): Promise<any> {
    return apiClient.post<any>(endpoints.surveys.saveDraft(surveyId), { status });
  },

  async getPublicSurvey(id: string): Promise<Survey> {
    return apiClient.get<Survey>(endpoints.surveys.public(id));
  },

  async submitAnswers(surveyId: string, answers: Record<string, string>): Promise<any> {
    return apiClient.post<any>(endpoints.surveys.submitAnswers(surveyId), { answers });
  },

  async getSurveyResponses(surveyId: string): Promise<any> {
    return apiClient.get<any>(endpoints.surveys.responses(surveyId));
  },
};
