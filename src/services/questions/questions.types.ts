/**
 * RIO-FR-012 — Question Bank management. A management row is the same
 * Question Bank master data the Survey Builder browses (see
 * surveys.service.ts's `Question`), plus the two fields that only matter
 * for admin curation: whether the question is currently selectable
 * (`isActive`) and, if not, when it was deactivated.
 */
export interface QuestionManagementItem {
  id: string;
  questionId: string;
  domain: string;
  subDomain: string;
  indicator: string | null;
  kpi: string | null;
  priorityWeight: number | null;
  questionText: string;
  answerType: string;
  answerOptions: string[] | null;
  requiredOptional: string;
  isActive: boolean;
  deactivatedAt: string | null;
}

export interface UpdateQuestionPayload {
  questionText?: string;
  domain?: string;
  subDomain?: string;
  indicator?: string | null;
  kpi?: string | null;
}
