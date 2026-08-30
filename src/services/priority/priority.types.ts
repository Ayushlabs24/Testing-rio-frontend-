/** RIO-FR-003 AC 2 — one row of the breakdown the reviewer sees, so the score
 * explains itself rather than arriving as a bare number.
 *
 * `value` is null when the evidence for that factor does not exist yet (an
 * unset urgency, a need with no themes). Null is shown as "Not measured" and
 * excluded from the weighted mean — deliberately NOT rendered as 0, which
 * would read as "we checked and it is nothing". */
export interface PriorityFactorComponent {
  key: string;
  label: string;
  weight: number;
  value: number | null;
  contribution: number | null;
  /** Plain-language source of the value — "450 people affected",
   *  "3 village(s)". Rendered under the number. */
  basis: string | null;
}

/** The stored `factors` JSON on a score. */
export interface PriorityFactorBreakdown {
  model: string;
  methodologyVersion: string | null;
  /** Share of the configured weight that had evidence behind it. */
  coverage: number;
  score: number;
  components: PriorityFactorComponent[];
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
  factors: PriorityFactorBreakdown;
  cycleNote: string | null;
  /** What the engine computed. Never rewritten by an override. */
  computedScore: number;
  /** RIO-FR-003 AC 5 — the reviewer's own number, kept beside the computed
   *  one so the two stay distinguishable. Null until someone disagrees. */
  overrideScore: number | null;
  overrideReason: string | null;
  overriddenAt: string | null;
  /** What to rank and display: the override when set, else the computed. */
  effectiveScore: number;
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
  /** RIO-FR-003 AC 6 — filter and group by theme without a second fetch. */
  themes: string[];
  /** RIO-FR-003 AC 1 — an unset urgency is a real gap in the score, so it is
   *  visible in the list rather than only on the need page. */
  urgency: string | null;
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

// Mirrors the backend's DomainPriorityComponent (priority-v2.service.ts) —
// one row per domain in a village's most recent priority calculation.
export interface DomainPriorityComponent {
  domainKey: string;
  domainNameSnapshot: string;
  domainSeverityScore: number;
  domainPerformanceScore: number;
  domainWeight: number;
  weightedContribution: number;
  isCriticalDomain: boolean;
  criticalThreshold: number;
  triggeredOverride: boolean;
}

export interface VillageComparisonEntry {
  village: string;
  studyIds: string[];
  priorityScore: number | null;
  priorityStatus: string | null;
  // RIO-FR-005 criterion 2 — per-domain severity, already computed by
  // VillageAggregationService; null until the village has a scored Need.
  domainComponents: DomainPriorityComponent[] | null;
  criticalNeedCount: number;
  highNeedCount: number;
  needTypeCounts: Record<string, number>;
  totalNeedCount: number;
  // RIO-FR-005 (Round 4, client-confirmed 2026-08-24) — sum of each Need's
  // manually entered affectedPeople/affectedHouseholds for this village.
  // Null (not 0) when none of the village's Needs have a value entered yet.
  affectedPeople: number | null;
  affectedHouseholds: number | null;
}
