export type DecisionStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface NeedDecisionStatusEvent {
  id: string;
  fromStatus: DecisionStatus | null;
  toStatus: DecisionStatus;
  changedBy: string;
  changedAt: string;
  note: string | null;
}

export interface NeedDecision {
  id: string;
  needId: string;
  decisionType: string;
  responsibleParty: string;
  status: DecisionStatus;
  /** ISO date (YYYY-MM-DD) — the decision's own effective date, distinct
   * from createdAt. */
  decisionDate: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  history: NeedDecisionStatusEvent[];
}

export interface CreateNeedDecisionPayload {
  decisionType: string;
  responsibleParty: string;
  decisionDate: string;
  notes?: string;
}

export interface UpdateNeedDecisionStatusPayload {
  status: DecisionStatus;
  note?: string;
}
