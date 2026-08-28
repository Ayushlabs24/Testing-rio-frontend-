export type QuestionBankAlertChangeKind = "created" | "edited" | "deactivated";

export interface QuestionBankPendingAlert {
  id: string;
  type: "question_pending_approval";
  changeKind: QuestionBankAlertChangeKind;
  questionRowId: string;
  questionId: string;
  questionText: string;
  domain: string;
  subDomain: string;
  submittedAt: string;
}

export interface QuestionBankResolvedAlert {
  id: string;
  type: "question_resolved";
  resolution: "approved" | "rejected";
  questionRowId: string;
  questionId: string;
  questionText: string;
  domain: string;
  subDomain: string;
  reviewedAt: string;
  rejectionReason: string | null;
}

export type QuestionBankAlert = QuestionBankPendingAlert | QuestionBankResolvedAlert;
