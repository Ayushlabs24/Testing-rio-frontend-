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
  // RIO-FR-012 (Q30/Q31, client-confirmed 2026-08-20) — every edit creates
  // a new pending version; only an approved + current row is ever live for
  // new surveys. See QuestionsService (backend) for the full mechanism.
  version: number;
  isCurrentVersion: boolean;
  approvalStatus: "approved" | "pending_approval" | "rejected";
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface UpdateQuestionPayload {
  questionText?: string;
  domain?: string;
  subDomain?: string;
  indicator?: string | null;
  kpi?: string | null;
}
