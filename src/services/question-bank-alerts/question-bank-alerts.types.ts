export type QuestionBankAlertChangeKind = "created" | "edited" | "deactivated";

export interface QuestionBankAlert {
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
