export type SlaAlertStatus = "pending" | "at_risk" | "breached";

/** Two different queues share this shape — an AiDecision awaiting
 * classification review, and a Survey sitting SUBMITTED awaiting
 * Approve/Reject. `type` says which; `id` is whichever underlying row
 * (AiDecision.id or Survey.id) — use it as the list key, not
 * `aiDecisionId` (removed, since it doesn't exist for survey alerts). */
export type SlaAlertType = "ai_classification" | "survey_approval";

export interface SlaAlert {
  id: string;
  type: SlaAlertType;
  needId: string;
  studyId: string;
  surveyId: string | null;
  studyTitle: string;
  needStatement: string | null;
  touchpoint: string;
  createdAt: string;
  dueAt: string;
  status: SlaAlertStatus;
}

export interface SlaConfig {
  slaHours: number;
  pollIntervalMs: number;
}
