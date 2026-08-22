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
  // RIO-FR-005 (Q12) — the Need's own analyst-entered Gap Type
  // classification (acute/chronic/structural/seasonal/equity), distinct
  // from `score.overrideReason` below.
  gapType: string | null;
  score: {
    overallScore: number;
    level: "critical" | "high" | "medium" | "low";
    overrideReason: string | null;
    scoredAt: string;
  } | null;
}

// RIO-FR-005 (Q12, client-confirmed) — final, no additions.
export const GAP_TYPES = [
  "acute",
  "chronic",
  "structural",
  "seasonal",
  "equity",
] as const;
export type GapType = (typeof GAP_TYPES)[number];

// RIO-FR-005 (Q9) — affected population is deliberately absent: no data
// source for it exists anywhere in the platform yet (see the backend's own
// comment on this type for why it isn't faked with a placeholder).
export interface VillageComparisonEntry {
  village: string;
  studyIds: string[];
  priorityScore: number | null;
  priorityStatus: string | null;
  domainComponents: unknown | null;
  criticalNeedCount: number;
  highNeedCount: number;
  needTypeCounts: Record<string, number>;
  totalNeedCount: number;
}
