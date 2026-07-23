export interface CollectiveDashboard {
  scope: {
    studyCount: number;
    needCount: number;
    generatedAt: string;
  };
  kpis: {
    needCount: number;
    scoringDistribution: Array<{ band: string; count: number }>;
    slaCompliancePct: number | null;
    slaBreaches: number;
    slaAtRisk: number;
  };
  executiveSummary: {
    topPriorities: Array<{
      rank: number;
      label: string;
      domain: string;
      severityScore: number;
      entity?: string;
    }>;
    trends: Array<{ label: string; direction: "up" | "down" | "flat"; note: string }>;
    anomalies: Array<{ severity: "info" | "warning" | "critical"; note: string }>;
    reviewerNotes: Array<{ author: string; note: string; at: string }>;
  };
  filters: Record<string, unknown>;
}
