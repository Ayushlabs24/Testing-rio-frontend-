// Mirrors the backend's NcnpReport shape exactly (src/modules/ncnp-report/
// ncnp-report.types.ts) — kept as a hand-written twin rather than a shared
// package, same convention every other service in this app already follows.

export interface NcnpPeriodStat {
  current: number;
  previous: number;
  changePct: number | null;
}

export interface NcnpReportSummary {
  totals: {
    organizations: number;
    studies: number;
    surveys: number;
    responses: number;
    needs: number;
  };
  newThisPeriod: {
    periodDays: number;
    organizations: NcnpPeriodStat;
    studies: NcnpPeriodStat;
    surveys: NcnpPeriodStat;
    responses: NcnpPeriodStat;
  };
}

export interface NcnpOrgNeedingAttention {
  organizationId: string;
  organizationName: string;
  lastActivity: string | null;
}

export interface NcnpOrgHealth {
  active: number;
  inactive: number;
  dormant: number;
  dormantDays: number;
  needsAttention: NcnpOrgNeedingAttention[];
}

export interface NcnpDomainBreakdown {
  domainCode: string;
  domainName: string;
  needCount: number;
}

export interface NcnpStudyStatus {
  active: number;
  archived: number;
}

// PublicSurveyLink.isActive, aggregated platform-wide — the citizen-facing
// link's Open/Closed state, distinct from the survey's own approval
// workflow status shown on the Public Survey Overview page.
export interface NcnpPublicLinkStatus {
  open: number;
  closed: number;
}

export interface NcnpNamedBreakdown {
  id: string;
  name: string;
  count: number;
}

export interface NcnpGeographyOverview {
  organizationsByRegion: NcnpNamedBreakdown[];
  organizationsByGovernorate: NcnpNamedBreakdown[];
  organizationsByCenter: NcnpNamedBreakdown[];
  studiesByRegion: NcnpNamedBreakdown[];
}

// Kingdom-wide rollup of Needs themselves (not orgs, not surveys).
export interface NcnpNeedsGeography {
  byRegion: NcnpNamedBreakdown[];
  byGovernorate: NcnpNamedBreakdown[];
  byCenter: NcnpNamedBreakdown[];
}

export interface NcnpSubDomainBreakdown {
  domainName: string;
  subDomainName: string;
  needCount: number;
}

export interface NcnpOrgSummaryRow {
  organizationId: string;
  organizationName: string;
  studyCount: number;
  surveyCount: number;
  responseCount: number;
  isActive: boolean;
}

export interface NcnpOrgSummary {
  byStudies: NcnpOrgSummaryRow[];
  bySurveys: NcnpOrgSummaryRow[];
  byResponses: NcnpOrgSummaryRow[];
  totalOrganizations: number;
}

export interface NcnpTopOrgByStudyCount {
  organizationId: string;
  organizationName: string;
  studyCount: number;
}

export interface NcnpStudyOverview {
  topOrgsByStudyCount: NcnpTopOrgByStudyCount[];
  totalOrganizations: number;
  studiesCreatedTrend: NcnpMonthlyPoint[];
}

export interface NcnpSurveyGeography {
  byRegion: NcnpNamedBreakdown[];
  byGovernorate: NcnpNamedBreakdown[];
  byCenter: NcnpNamedBreakdown[];
}

export interface NcnpRegionSummaryRow {
  regionId: string;
  regionName: string;
  surveyCount: number;
  responseCount: number;
  avgResponsesPerSurvey: number;
}

export interface NcnpSurveyStatus {
  draft: number;
  submitted: number;
  published: number;
  rejected: number;
}

export interface NcnpRegionBreakdown {
  regionId: string;
  regionName: string;
  count: number;
}

export interface NcnpRegionSurveyStatus extends NcnpRegionBreakdown {
  status: NcnpSurveyStatus;
}

// reasonCode is the Prisma enum identifier (e.g. "REJ_01", "REJ_99"), or
// "UNSPECIFIED" for surveys rejected before this field existed.
export interface NcnpRejectionReasonBreakdown {
  reasonCode: string;
  count: number;
}

export interface NcnpSurveyAnalytics {
  statusPlatformWide: NcnpSurveyStatus;
  statusByRegion: NcnpRegionSurveyStatus[];
  avgResponsesPerPublishedSurvey: number;
  rejectionReasonBreakdown: NcnpRejectionReasonBreakdown[];
}

export interface NcnpMonthlyPoint {
  month: string;
  count: number;
}

export interface NcnpGenderBreakdown {
  gender: string;
  count: number;
}

// ageBracket is the Prisma enum identifier (e.g. "age_15_24",
// "prefer_not_to_say").
export interface NcnpAgeBracketBreakdown {
  ageBracket: string;
  count: number;
}

export interface NcnpOrgResponseStat {
  organizationId: string;
  organizationName: string;
  value: number;
}

export interface NcnpResponseAnalytics {
  monthlyTrend: NcnpMonthlyPoint[];
  responsesByRegion: NcnpRegionBreakdown[];
  genderDistribution: NcnpGenderBreakdown[];
  // Only responses that actually have an age bracket recorded — never
  // padded/backfilled for responses collected before this field existed.
  ageBracketDistribution: NcnpAgeBracketBreakdown[];
  // True when at least one response has no ageBracket value (collected
  // before this feature went live) — must be disclosed, never silently
  // treated as zero/excluded without a note.
  hasResponsesWithoutAgeBracket: boolean;
  topOrgsByTotalResponses: NcnpOrgResponseStat[];
  topOrgsByAvgResponsesPerSurvey: NcnpOrgResponseStat[];
}

export interface NcnpPriorityLevelBreakdown {
  status: string;
  count: number;
}

export interface NcnpDomainComparison {
  domainKey: string;
  domainName: string;
  avgPerformanceScore: number;
  isCriticalDomain: boolean;
  assessmentCount: number;
}

export interface NcnpVillageScorecard {
  studyId: string;
  surveyId: string;
  villageId: string;
  priorityScore: number;
  priorityStatus: string;
}

export interface NcnpPriorityOverview {
  byStatus: NcnpPriorityLevelBreakdown[];
  domainComparison: NcnpDomainComparison[];
  topPriorityVillages: NcnpVillageScorecard[];
}

// A single Need, ranked by its own survey's village-priority assessment —
// see the backend's NcnpReportService.buildCriticalNeeds for exactly how
// "critical" and `primaryGap` are derived from real, existing data (there is
// no need-level severity_score/gap_type field in the schema).
export interface NcnpPriorityNeedRow {
  needId: string;
  needTitle: string;
  domain: string | null;
  subDomain: string | null;
  organizationName: string;
  priorityScore: number;
  priorityStatus: string;
  primaryGap: string | null;
  evidenceCount: number;
  source: string;
  // Unified Need Record Schema fields — all derived/joined from existing
  // data on the backend, no new columns.
  equityFlag: boolean;
  indicatorId: string | null;
  unitGeoRegion: string | null;
  sourceRef: string | null;
}

export interface NcnpCriticalNeedsOverview {
  topCriticalNeeds: NcnpPriorityNeedRow[];
  priorityNeeds: NcnpPriorityNeedRow[];
  totalRankableNeeds: number;
  totalNeeds: number;
}

// Always present, even when every count is zero.
export interface NcnpDataQualityNotes {
  totalResponses: number;
  assessedResponses: number;
  lowConfidenceCount: number;
  duplicateFlaggedCount: number;
  totalNeeds: number;
  needsWithEvidence: number;
  needsWithoutEvidence: number;
  needsUnclassified: number;
}

export interface NcnpDomainRegionIntersection {
  regionName: string;
  domainName: string;
  needCount: number;
}

export interface NcnpReport {
  generatedAt: string;
  summary: NcnpReportSummary;
  orgHealth: NcnpOrgHealth;
  orgSummary: NcnpOrgSummary;
  needDomains: NcnpDomainBreakdown[];
  needSubDomains: NcnpSubDomainBreakdown[];
  needsGeography: NcnpNeedsGeography;
  studyStatus: NcnpStudyStatus;
  publicLinkStatus: NcnpPublicLinkStatus;
  studyOverview: NcnpStudyOverview;
  geography: NcnpGeographyOverview;
  surveyAnalytics: NcnpSurveyAnalytics;
  surveyGeography: NcnpSurveyGeography;
  regionSummary: NcnpRegionSummaryRow[];
  responseAnalytics: NcnpResponseAnalytics;
  priorityOverview: NcnpPriorityOverview;
  criticalNeeds: NcnpCriticalNeedsOverview;
  dataQualityNotes: NcnpDataQualityNotes;
  domainRegionIntersections: NcnpDomainRegionIntersection[];
}
