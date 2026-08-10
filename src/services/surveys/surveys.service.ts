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
  domain: string | null;
  subDomain: string | null;
  indicator: string | null;
  kpi: string | null;
  isCustom: boolean;
  order: number;
  isRequired: boolean;
}

/** A custom (open-ended) question a Research Officer previously typed in
 * from scratch on some OTHER survey targeting the same Domain/Sub-domain —
 * shown in the Survey Builder's "Custom Questions" tab so it can be reused
 * instead of retyped. `id` is the originating SurveyQuestion's own id, only
 * useful as a stable list key here — adding one to the current survey
 * copies its text/type/options into a brand-new SurveyQuestion row, it's
 * never linked by reference the way a Question Bank item is. */
export interface ReusableCustomQuestion {
  id: string;
  questionText: string;
  answerType: string;
  answerOptions: string[] | null;
  domain: string | null;
  subDomain: string | null;
  kpi: string | null;
  sourceSurveyTitle: string;
}

/** DRAFT -> SUBMITTED -> PUBLISHED, or SUBMITTED -> REJECTED -> (edit) ->
 * SUBMITTED again. See the backend SurveysService for the full state
 * machine and who's allowed to make each transition.
 *
 * SUPERSEDED (RIO-FR-011): a PUBLISHED survey moves here, permanently, the
 * moment a newer version created from it (see `createNewVersion` below)
 * itself gets published. Its questions and every response already attached
 * to it are never touched — only this status flag changes, so exactly one
 * PUBLISHED survey ever exists per Need at a time. */
export type SurveyStatus =
  "DRAFT" | "SUBMITTED" | "REJECTED" | "PUBLISHED" | "SUPERSEDED";

/** Matches the Prisma RejectionReasonCode enum's identifiers exactly (see
 * schema.prisma). REJ_99 is "Other". `approverComments` (reviewer notes) is
 * required for every code now; see the reject dialog's validation. */
export type RejectionReasonCode =
  "REJ_01" | "REJ_02" | "REJ_03" | "REJ_04" | "REJ_05" | "REJ_06" | "REJ_07" | "REJ_99";

export const REJECTION_REASON_LABELS: Record<RejectionReasonCode, string> = {
  REJ_01: "Incomplete survey design",
  REJ_02: "Methodology non-compliance",
  REJ_03: "Duplicate of an existing survey",
  REJ_04: "Incorrect need or study linkage",
  REJ_05: "Out-of-scope geography or target population",
  REJ_06: "Data quality concerns",
  REJ_07: "Missing required attachments or approvals",
  REJ_99: "Other",
};

/** One row of GET /surveys — the shape the survey picker needs. */
export interface SurveyListItem {
  id: string;
  title: string;
  needId: string;
  studyId: string | null;
  studyTitle: string | null;
  status: SurveyStatus | string;
  /** Responses collected for this survey's Need — 0 means nothing to report on. */
  responseCount: number;
  publishedAt: string | null;
  createdAt: string | null;
  /** RIO-FR-011: 1 for a survey that's never been versioned. Lets a list
   * distinguish a Need's several Survey rows (e.g. v1 SUPERSEDED, v2
   * PUBLISHED) from one another instead of looking like duplicates. */
  version: number;
}

export interface Survey {
  id: string;
  needId: string;
  studyId: string;
  title: string;
  status: SurveyStatus;
  /** Snapshot of the active Methodology Version at the moment this Survey
   * was (most recently) published — null until first published. Never a
   * live reference: a later Methodology/Question Bank change never
   * retroactively changes what an already-published Survey shows here. */
  methodologyVersion: string | null;
  /** Survey Design step, completed before Submit for Approval — all four
   * null together until the Researcher saves this step (or on a survey
   * created before this feature existed). Shown read-only to the Approver
   * during review for context on who's being surveyed and how. */
  targetGroup: string | null;
  expectedSampleSize: number | null;
  selectionApproach: string | null;
  geographicCoverage: string | null;
  submittedAt: string | null;
  /** The Approver's reviewer notes for the most recent decision — mandatory
   * on both Approve & Publish and Reject. Set on REJECTED and on PUBLISHED
   * now; cleared the next time a rejected survey is resubmitted (never
   * cleared once PUBLISHED, since that's terminal). Null only for surveys
   * approved/rejected before this requirement existed. */
  approverComments: string | null;
  /** The Approver's structured rejection reason, alongside the free-text
   * approverComments above — same lifecycle (only set while REJECTED,
   * cleared on resubmit). Null for surveys rejected before this field
   * existed. */
  rejectionReasonCode: RejectionReasonCode | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectedByName: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  publishedByName: string | null;
  questions: SurveyQuestionItem[];
  /** RIO-FR-011: 1 for a survey that has never been versioned. Increments
   * each time createNewVersion runs. */
  version: number;
  /** RIO-FR-011: the id of the (now SUPERSEDED-or-still-PUBLISHED) survey
   * this one was copied from via createNewVersion — null for a v1 survey. */
  previousVersionId: string | null;
}

/** The approve/reject/submit endpoints' response — the raw Survey record
 * (no `questions`), since none of them touch the question list itself. */
export interface SurveyRecord {
  id: string;
  needId: string;
  studyId: string;
  title: string;
  status: SurveyStatus;
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
      domain?: string;
      subDomain?: string;
      kpi?: string;
      order: number;
      isRequired: boolean;
    };

/** Answer types an Additional (open-ended) question can take — distinct
 * from Question Bank answer types, since these are Survey Builder's own
 * vocabulary for study-specific questions: Free Text, Single Select, Multi
 * Select, True/False, Scale, Number. An options editor is only shown for
 * `multiple_choice`/`checkbox` (see CustomQuestionEditorDialog). */
export const ADDITIONAL_QUESTION_ANSWER_TYPES = [
  "long_text",
  "multiple_choice",
  "checkbox",
  "yes_no",
  "rating",
  "number",
] as const;
export type AdditionalQuestionAnswerType =
  (typeof ADDITIONAL_QUESTION_ANSWER_TYPES)[number];

export const surveysService = {
  /** Surveys under a study — the picker for survey-scoped reports (RPT01/RPT15).
   *  Returns the list ordered newest-first, exactly as the API sends it. */
  async listByStudy(studyId: string): Promise<SurveyListItem[]> {
    const res = await apiClient.get<{ items: SurveyListItem[] }>(endpoints.surveys.list, {
      params: { studyId },
    });
    return res.items ?? [];
  },

  async getDomainOptions(): Promise<QuestionOption[]> {
    return apiClient.get<QuestionOption[]>(endpoints.questionBank.domainOptions);
  },

  /** Distinct KPI values already in use across the Question Bank — free-text
   * suggestions for the Custom Question Editor's KPI field, not a fixed list
   * (see QuestionsService.getKpiOptions on the backend). */
  async getKpiOptions(): Promise<string[]> {
    return apiClient.get<string[]>(endpoints.questionBank.kpiOptions);
  },

  /** Empty `pairs` means "every active Question Bank entry" — the
   * allDomainsSelected case, where there's no specific Domain/Sub-domain to
   * filter by. Non-empty `pairs` matches any of them (a single classified
   * pair, or an already-approved multi-domain Need's several pairs). */
  async getQuestions(
    pairs: Array<{ domain: string; subDomain: string }>,
  ): Promise<Question[]> {
    return apiClient.get<Question[]>(endpoints.questionBank.questions, {
      params: pairs.length > 0 ? { pairs: JSON.stringify(pairs) } : {},
    });
  },

  /** Custom questions previously added to some other survey for this exact
   * Domain/Sub-domain — see ReusableCustomQuestion's own doc comment. Called
   * with no arguments for the allDomainsSelected case (AI couldn't classify)
   * — every reusable custom question is in scope then, same "match all"
   * convention as getQuestions([]) for the Question Bank tab. */
  async getReusableCustomQuestions(
    domain?: string,
    subDomain?: string,
  ): Promise<ReusableCustomQuestion[]> {
    return apiClient.get<ReusableCustomQuestion[]>(
      endpoints.surveys.reusableCustomQuestions,
      { params: domain && subDomain ? { domain, subDomain } : {} },
    );
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

  /** Researcher: picks the Methodology Version this survey will publish
   * under — mandatory before submitForApproval. Same editable-only window
   * as updateQuestions (DRAFT/REJECTED). The Approver never calls this. */
  async setMethodologyVersion(surveyId: string, version: string): Promise<Survey> {
    return apiClient.patch<Survey>(endpoints.surveys.setMethodologyVersion(surveyId), {
      version,
    });
  },

  /** Researcher: the Sample Description step — one Save action for all four
   * fields together, mandatory before submitForApproval. Same editable-only
   * window as updateQuestions (DRAFT/REJECTED). Shown read-only to the
   * Approver on the Survey object returned by every other endpoint here. */
  async setSampleDescription(
    surveyId: string,
    input: {
      targetGroup: string;
      expectedSampleSize: number;
      selectionApproach: string;
      geographicCoverage: string;
    },
  ): Promise<Survey> {
    return apiClient.patch<Survey>(
      endpoints.surveys.setSampleDescription(surveyId),
      input,
    );
  },

  /** Researcher: hands the current content to the Approver. Valid from
   * DRAFT (first submission) or REJECTED (resubmission). */
  async submitForApproval(surveyId: string): Promise<SurveyRecord> {
    return apiClient.post<SurveyRecord>(endpoints.surveys.submit(surveyId));
  },

  /** Approver-only. Combines approve + publish — there's no intermediate
   * "approved but not yet published" state. `comments` (reviewer notes) is
   * mandatory — enforced both here (the approve dialog) and again on the
   * backend. */
  async approveAndPublish(surveyId: string, comments: string): Promise<SurveyRecord> {
    return apiClient.post<SurveyRecord>(endpoints.surveys.approve(surveyId), {
      comments,
    });
  },

  /** Approver-only. `reasonCode` and `comments` (reviewer notes) are both
   * always required now, regardless of reasonCode — enforced both here (the
   * reject dialog) and again on the backend. */
  async rejectSurvey(
    surveyId: string,
    reasonCode: RejectionReasonCode,
    comments: string,
  ): Promise<SurveyRecord> {
    return apiClient.post<SurveyRecord>(endpoints.surveys.reject(surveyId), {
      reasonCode,
      comments,
    });
  },

  /** Researcher: the only way to change a PUBLISHED survey — creates a new
   * DRAFT version copying its questions/methodology/sample-description,
   * leaving the published original (and every response already attached to
   * it) untouched. Idempotent — calling it again on the same published
   * survey returns the already-created draft rather than making a second
   * one. */
  async createNewVersion(surveyId: string): Promise<Survey> {
    return apiClient.post<Survey>(endpoints.surveys.newVersion(surveyId));
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
