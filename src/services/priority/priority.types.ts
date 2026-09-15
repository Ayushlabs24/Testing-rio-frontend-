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
//
// `score` has two sources, tried in this order (PriorityV2Service#listForOrg):
//   1. The Need's own APPROVED PriorityScore — the per-need, reviewer-signed-
//      off number defined by the interface above. An unapproved score is never
//      sent here, so a need can be scored and still read "Not scored yet"
//      until someone signs it off.
//   2. Failing that, the village-priority rollup (VillagePriorityAssessment),
//      a separate weighted-domain pipeline that also feeds RPT14.
//
// Both arrive on the same 0-100 scale with high = urgent, so the column reads
// one way down the whole table regardless of which source filled it.
export interface PriorityDashboardEntry {
  studyId: string;
  studyTitle: string;
  needId: string;
  /** The Need's own title. Every Need under a Study shares that Study's name,
   *  so a table keyed only on studyTitle repeats one string down every row. */
  needTitle: string;
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
    /** Which of the two pipelines above produced `overallScore`, and so which
     *  way the number runs: `priorityScore` is a severity (high = urgent),
     *  `villageRollup` a performance figure (low = urgent). Only matters to
     *  code that does arithmetic on the number rather than displaying it — the
     *  Collective Dashboard's Severity column read the wrong direction for a
     *  while because it had no way to tell them apart. */
    source: "priorityScore" | "villageRollup";
  } | null;
}

// RIO-FR-005 (Q12, client-confirmed). Mirrors the backend's GapType union in
// `src/modules/priority/scoring.ts` — keep the two in step.
//
// `Conflict-related` keeps the client-approved list's exact casing rather than
// being lower-cased to match its neighbours, because that list is also what
// `prisma/import-arabic-config-lists.ts` translates against.
//
// Labels shown in the UI come from the GapTypeOption rows the API returns
// (name/nameAr), not from this union — this is the type-level contract only.
export const GAP_TYPES = [
  "acute",
  "Conflict-related",
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

/** One Domain's mean within a Centre. Same scale and direction as every other
 *  priority number: 0-100, high = urgent. */
export interface CenterDomainBreakdown {
  domain: string;
  needCount: number;
  averageScore: number;
  level: "critical" | "high" | "medium" | "low";
}

/** Grouped by Centre, not by `Need.village`. Village is free text a researcher
 *  types with nothing validating it — the client confirmed no authoritative
 *  village dataset exists — while Centre is a real key into their own
 *  geographic reference. Village names travel in `villages` as labels.
 *
 *  `priorityScore` is the mean of this Centre's approved Need PriorityScores,
 *  so it reads on the same 0-100 scale and in the same direction as a single
 *  need's score. It replaced a second, separately-computed figure that ran the
 *  opposite way (low meant urgent), which had already caused one real bug. */
export interface CenterComparisonEntry {
  centerId: string;
  centerName: string;
  centerNameAr: string | null;
  governorateName: string | null;
  governorateNameAr: string | null;
  regionName: string | null;
  regionNameAr: string | null;
  villages: string[];
  studyIds: string[];
  priorityScore: number | null;
  priorityStatus: "critical" | "high" | "medium" | "low" | null;
  /** How many of `totalNeedCount` carried an approved score — the mean is
   *  over these, so a place scored on 2 of 9 needs is not read as complete. */
  scoredNeedCount: number;
  domainBreakdown: CenterDomainBreakdown[];
  criticalNeedCount: number;
  highNeedCount: number;
  needTypeCounts: Record<string, number>;
  totalNeedCount: number;
  // RIO-FR-005 (Round 4, client-confirmed 2026-08-24) — sum of each Need's
  // manually entered affectedPeople/affectedHouseholds at this Centre.
  // Null (not 0) when none of them have a value entered yet.
  affectedPeople: number | null;
  affectedHouseholds: number | null;
}
