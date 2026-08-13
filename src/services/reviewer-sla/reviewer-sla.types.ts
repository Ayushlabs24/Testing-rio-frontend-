export type SlaAlertStatus = "pending" | "at_risk" | "breached";

/** Which queue(s) you get back depends on your own role/permissions — the
 * backend (ReviewerSlaService.listAlerts) merges whichever apply, never
 * shows you a queue you don't hold permission for:
 *  - survey_approval: org-wide Surveys sitting SUBMITTED awaiting YOUR
 *    Approve/Reject — shown only to a Reviewer/Approver (surveyBuilder:approve).
 *  - survey_ready_to_publish / survey_rejected: YOUR OWN Surveys (the ones
 *    you submitted) that just reached APPROVED/REJECTED — shown only to the
 *    Research Officer who created them. Client-confirmed (Aug 13 call):
 *    approval no longer auto-publishes, so "approved" now means "go
 *    publish it yourself," not "it's already live." `comments` is set only
 *    for survey_rejected (the Approver's reason). Nothing here is racing an
 *    SLA clock (already resolved/actionable-by-you) — `status` is always
 *    "pending", meaning "unread," not "at risk."
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
 *  - evidence_document_uploaded: org-wide EvidenceDocuments linked to a Need
 *    that don't have an AI Evidence Summary yet — shown only to whoever
 *    holds priorityScoring:create (the Data Analyst; the Research Officer
 *    who uploaded it doesn't see it echoed back). Links to the Priority
 *    Dashboard for that Need. No SLA clock — `status` is always "pending",
 *    and it auto-resolves once a summary is generated for the document.
 * `id` is whichever underlying row (AiDecision.id, Survey.id, Report.id, or
 * EvidenceDocument.id) — use it as the list key. `needId`/`studyId`/
 * `surveyId` are only ever set for the survey_* and evidence_document_uploaded
 * types (a Report can be org-wide, with no Study at all); `reportId` is only
 * set for the report_* types instead. `studyTitle` doubles as "the link
 * text" for every kind — a real Study title for survey/evidence alerts, the
 * Report's own title for report alerts. */
export type SlaAlertType =
  | "ai_classification"
  | "survey_approval"
  | "survey_ready_to_publish"
  | "survey_rejected"
  | "report_approval"
  | "report_released"
  | "report_rejected"
  | "evidence_document_uploaded";

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
