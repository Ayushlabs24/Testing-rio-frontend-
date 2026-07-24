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

// Org-wide dashboard row — every Need, whether or not it's been scored yet.
// Backed by the real village-priority pipeline (weighted domain rollup, per
// the org's methodology config) — not the older per-indicator PriorityScore
// above, which no screen writes to anymore.
export interface PriorityDashboardEntry {
  studyId: string;
  studyTitle: string;
  needId: string;
  score: {
    overallScore: number;
    level: "critical" | "high" | "medium" | "low";
    gapType: string | null;
    scoredAt: string;
  } | null;
}
