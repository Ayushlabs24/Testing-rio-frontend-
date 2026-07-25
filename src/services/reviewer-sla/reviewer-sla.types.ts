export type SlaAlertStatus = "pending" | "at_risk" | "breached";

/** Which queue you get back depends on your own role — the backend
 * (ReviewerSlaService.listAlerts) branches on it, never mixes them:
 *  - survey_approval: org-wide Surveys sitting SUBMITTED awaiting YOUR
 *    Approve/Reject — shown only to a Reviewer/Approver.
 *  - survey_approved / survey_rejected: YOUR OWN Surveys (the ones you
 *    submitted) that just reached PUBLISHED/REJECTED — shown only to the
 *    Research Officer who created them. `comments` is set only for
 *    survey_rejected (the Approver's reason). Nothing here is racing an
 *    SLA clock (already resolved) — `status` is always "pending", meaning
 *    "unread," not "at risk."
 * `id` is whichever underlying row (AiDecision.id or Survey.id) — use it
 * as the list key. */
export type SlaAlertType =
  "ai_classification" | "survey_approval" | "survey_approved" | "survey_rejected";

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
  comments?: string | null;
}

export interface SlaConfig {
  slaHours: number;
  pollIntervalMs: number;
}
