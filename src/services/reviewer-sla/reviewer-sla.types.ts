export type SlaAlertStatus = "pending" | "at_risk" | "breached";

export interface SlaAlert {
  aiDecisionId: string;
  studyId: string;
  studyTitle: string;
  needStatement: string | null;
  touchpoint: string;
  createdAt: string;
  dueAt: string;
  status: SlaAlertStatus;
  /** Null = no reviewer assigned — render as "Unassigned". Always reflects the Study's current assignment. */
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
}

export interface SlaConfig {
  slaHours: number;
  pollIntervalMs: number;
}
