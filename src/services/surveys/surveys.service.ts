import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";

export interface QuestionOption {
  domain: string;
  subDomain: string;
}

/** A raw Question Bank row (from `getQuestions`) — master data, never
 * editable from the Survey Builder. */
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

/**
 * One question inside a Survey — either a Question Bank question
 * (`isCustom: false`, `bankQuestionId` set, text/type/options/indicator/kpi
 * all read-only, sourced from the Question Bank) or an additional
 * open-ended question a Research Officer added directly on this survey
 * (`isCustom: true`, `bankQuestionId` null, no indicator/kpi — those are
 * Question Bank concepts this kind of question doesn't have). `id` is
 * always this survey-question's own id — the one identity that exists for
 * both kinds, safe to use as a list key and as the answer-submission key.
 */
export interface SurveyQuestionItem {
  id: string;
  bankQuestionId: string | null;
  questionCode: string | null;
  questionText: string;
  answerType: string;
  answerOptions: string[] | null;
  indicator: string | null;
  kpi: string | null;
  isCustom: boolean;
  order: number;
  isRequired: boolean;
}

export interface Survey {
  id: string;
  needId: string;
  studyId: string;
  title: string;
  status: string;
  /** Snapshot of the active Methodology Version at the moment this Survey
   * was (most recently) published — null until first published. Never a
   * live reference: a later Methodology/Question Bank change never
   * retroactively changes what an already-published Survey shows here. */
  methodologyVersion: string | null;
  questions: SurveyQuestionItem[];
}

/** `saveDraft`'s response — the raw Survey record (no `questions`), since
 * publishing only ever flips `status`, never touches the question list. */
export interface SurveyRecord {
  id: string;
  needId: string;
  studyId: string;
  title: string;
  status: string;
}

export interface SubmitAnswersResult {
  id: string;
  submittedAt: string;
}

export interface ResponseSlice {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface QuestionResponseStats {
  questionId: string;
  questionText: string;
  answerType: string;
  slices: ResponseSlice[];
  textResponses?: string[];
}

export interface SurveyResponseStats {
  id: string;
  title: string;
  status: string;
  totalRespondents: number;
  stats: QuestionResponseStats[];
}

/**
 * What a Save persists for one question — exactly one of `questionId` (a
 * Question Bank row's id, to keep/add a bank question) or `customText` (an
 * additional question); never both. Mirrors the backend's
 * SurveysService.updateQuestions validation.
 */
export type SaveSurveyQuestionInput =
  | { questionId: string; order: number; isRequired: boolean }
  | {
      customText: string;
      customAnswerType?: string;
      customOptions?: string[];
      order: number;
      isRequired: boolean;
    };

/** Answer types an Additional (open-ended) question can take — distinct
 * from Question Bank answer types, since these are Survey Builder's own
 * vocabulary for study-specific questions. */
export const ADDITIONAL_QUESTION_ANSWER_TYPES = [
  "long_text",
  "short_text",
  "multiple_choice",
  "checkbox",
  "yes_no",
  "rating",
] as const;
export type AdditionalQuestionAnswerType =
  (typeof ADDITIONAL_QUESTION_ANSWER_TYPES)[number];

export const surveysService = {
  async getDomainOptions(): Promise<QuestionOption[]> {
    return apiClient.get<QuestionOption[]>(endpoints.questionBank.domainOptions);
  },

  async getQuestions(domain: string, subDomain: string): Promise<Question[]> {
    return apiClient.get<Question[]>(endpoints.questionBank.questions, {
      params: { domain, subDomain },
    });
  },

  async getSurveyByNeedId(needId: string): Promise<Survey | null> {
    return apiClient.get<Survey | null>(endpoints.surveys.forNeed(needId));
  },

  async recommendQuestions(needId: string): Promise<Survey> {
    return apiClient.post<Survey>(endpoints.surveys.recommendQuestions(needId));
  },

  /** "Build Manually" path — an empty DRAFT survey with no questions yet, so
   * the Survey Builder page has something to attach questions to via its
   * add-from-Question-Bank combobox, without calling Gemini at all. */
  async createEmptySurvey(needId: string): Promise<Survey> {
    return apiClient.post<Survey>(endpoints.surveys.forNeed(needId));
  },

  async updateQuestions(
    surveyId: string,
    questions: SaveSurveyQuestionInput[],
  ): Promise<Survey> {
    return apiClient.patch<Survey>(endpoints.surveys.updateQuestions(surveyId), {
      questions,
    });
  },

  async saveDraft(surveyId: string, status?: string): Promise<SurveyRecord> {
    return apiClient.post<SurveyRecord>(endpoints.surveys.saveDraft(surveyId), {
      status,
    });
  },

  async getPublicSurvey(id: string): Promise<Survey> {
    return apiClient.get<Survey>(endpoints.surveys.public(id));
  },

  async submitAnswers(
    surveyId: string,
    answers: Record<string, string>,
  ): Promise<SubmitAnswersResult> {
    return apiClient.post<SubmitAnswersResult>(
      endpoints.surveys.submitAnswers(surveyId),
      { answers },
    );
  },

  async getSurveyResponses(surveyId: string): Promise<SurveyResponseStats> {
    return apiClient.get<SurveyResponseStats>(endpoints.surveys.responses(surveyId));
  },
};
