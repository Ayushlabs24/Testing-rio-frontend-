export type SlaAlertStatus = "pending" | "at_risk" | "breached";

/** Which queue(s) you get back depends on your own role/permissions — the
 * backend (ReviewerSlaService.listAlerts) merges whichever apply, never
 * shows you a queue you don't hold permission for:
 *  - survey_approval: org-wide Surveys sitting SUBMITTED awaiting YOUR
 *    Approve/Reject — shown only to a Reviewer/Approver (surveyBuilder:approve).
 *  - survey_approved / survey_rejected: YOUR OWN Surveys (the ones you
 *    submitted) that just reached PUBLISHED/REJECTED — shown only to the
 *    Research Officer who created them. `comments` is set only for
 *    survey_rejected (the Approver's reason). Nothing here is racing an
 *    SLA clock (already resolved) — `status` is always "pending", meaning
 *    "unread," not "at risk."
 *  - report_approval: org-wide Reports the Research Officer has confirmed
 *    but that are still awaiting YOUR Approve/Reject — shown to whoever
 *    holds reportsDashboards:approve. Reports have no configured SLA clock,
 *    so `status` is always "pending" here — a plain notification, not a
 *    breach-timed one.
 *  - report_released / report_rejected: YOUR OWN Reports (the ones you
 *    generated and confirmed) that just got approved/rejected — shown only
 *    to the Research Officer who generated them (reportsDashboards:write
 *    without :approve). No `comments` today — Report rejection has no
 *    reason field yet, unlike Survey rejection.
 * `id` is whichever underlying row (AiDecision.id, Survey.id, or Report.id)
 * — use it as the list key. `needId`/`studyId`/`surveyId` are only ever set
 * for the survey_* types (a Report can be org-wide, with no Study at all);
 * `reportId` is only set for the report_* types instead. `studyTitle`
 * doubles as "the link text" for either kind — a real Study title for
 * survey alerts, the Report's own title for report alerts. */
export type SlaAlertType =
  | "ai_classification"
  | "survey_approval"
  | "survey_approved"
  | "survey_rejected"
  | "report_approval"
  | "report_released"
  | "report_rejected";

export interface SlaAlert {
  id: string;
  type: SlaAlertType;
  needId: string | null;
  studyId: string | null;
  surveyId: string | null;
  reportId: string | null;
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
