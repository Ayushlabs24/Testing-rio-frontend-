export interface PublicSurveyLink {
  id: string;
  needId: string;
  studyId: string;
  /** User-facing name — the only identifier ever shown for a link; never the token/id. */
  label: string;
  token: string;
  /** Plain public URL — QR is rendered client-side from this, no server-generated image. */
  publicUrl: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  responseCount: number;
}

export interface CreateSurveyLinkPayload {
  label: string;
  expiresInDays?: number;
}

/** One row in the Survey Responses list — full answers only load on demand
 * via `getResponse` (see SurveyResponseDetail). */
export interface SurveyResponseSummary {
  id: string;
  needId: string;
  surveyLinkId: string;
  contactName: string | null;
  contact: string;
  submittedAt: string;
}

/** A survey can collect thousands of public responses — the list view is
 * server-paginated, never fetched all at once. */
export interface SurveyResponseListResult {
  items: SurveyResponseSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** One answered question, enriched with the question's own text/type — the
 * raw `answers` JSON is keyed by SurveyQuestion id and meaningless without
 * this join, which the backend already does. */
export interface SurveyResponseAnswer {
  questionId: string;
  questionText: string;
  answerType: string;
  answer: string | null;
}

export interface SurveyResponseDetail extends SurveyResponseSummary {
  answers: SurveyResponseAnswer[];
}

export type SurveyResponseExportFormat = "csv" | "excel";

/** One respondent's answer to one specific question — a row on the
 * dedicated per-question responses page. */
export interface QuestionResponseRow {
  responseId: string;
  respondentName: string | null;
  contact: string;
  answer: string | null;
  submittedAt: string;
}

export interface QuestionResponseListResult {
  questionId: string;
  questionText: string;
  answerType: string;
  items: QuestionResponseRow[];
  total: number;
  limit: number;
  offset: number;
}
