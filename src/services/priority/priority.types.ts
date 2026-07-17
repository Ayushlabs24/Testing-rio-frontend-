export interface PriorityFactor {
  key: string;
  label: string;
  value: number;
  weight: number;
}

export interface PriorityScore {
  id: string;
  studyId: string;
  /** Null = Consolidated (every Survey Link); set = scoped to just that one link. */
  surveyLinkId: string | null;
  overallScore: number;
  level: "critical" | "high" | "medium" | "low";
  gapType: string;
  factors: PriorityFactor[];
  cycleNote: string | null;
  scoredAt: string;
  /** Always true — placeholder scoring, not the real methodology workbook. */
  isPlaceholder: true;
}

// Org-wide dashboard row — every study, whether or not it's been scored yet.
export interface PriorityDashboardEntry {
  studyId: string;
  studyTitle: string;
  studyStatus: string;
  score: PriorityScore | null;
}
