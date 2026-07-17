/** Explainable breakdown — one entry per indicator that fed this score. */
export interface PriorityFactor {
  indicator: string;
  weight: number;
  responseValue: number;
  weightedContribution: number;
}

export interface PriorityScore {
  id: string;
  needId: string;
  studyId: string;
  /** Null = Consolidated (every Survey Link); set = scoped to just that one link. */
  surveyLinkId: string | null;
  /** The normalized 0-100 severity score. */
  overallScore: number;
  level: "critical" | "high" | "medium" | "low";
  gapType: string;
  factors: PriorityFactor[];
  cycleNote: string | null;
  scoredAt: string;
  /** A Priority Score never becomes publicly visible (dashboard/reports)
   * until a reviewer approves it. */
  isApproved: boolean;
  approvedAt: string | null;
}

// Org-wide dashboard row — every Need, whether or not it's been scored (and
// approved) yet.
export interface PriorityDashboardEntry {
  studyId: string;
  studyTitle: string;
  needId: string;
  score: PriorityScore | null;
}
