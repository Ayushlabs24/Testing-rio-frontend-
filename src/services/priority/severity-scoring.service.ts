import { apiClient } from "@/services/api/client";
import type { RequestOptions } from "@/services/api/types";

export interface MethodologyVersion {
  id: string;
  name: string;
  version: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface SeverityDashboardResult {
  overall: {
    severityScore: number | null;
    confidenceLevel: string;
    validResponseCount: number;
    dontKnowRate: number;
  } | null;
  domains: Array<{
    id: string;
    name: string;
    severityScore: number | null;
    confidenceLevel: string;
    validResponseCount: number;
  }>;
  subDomains: Array<{
    id: string;
    name: string;
    severityScore: number | null;
    confidenceLevel: string;
  }>;
  indicators: Array<{
    id: string;
    name: string;
    severityScore: number | null;
    confidenceLevel: string;
  }>;
  kpis: Array<{
    id: string;
    name: string;
    severityScore: number | null;
    confidenceLevel: string;
  }>;
  methodologyVersion: string;
}

export interface SeverityKpiRankingEntry {
  rank: number;
  kpi: string;
  indicator: string;
  subDomain: string;
  domain: string;
  severityScore: number | null;
  validResponseCount: number;
  dontKnowRate: number;
  confidenceLevel: string;
}

export interface QuestionDetailResult {
  questionId: string;
  questionText: string;
  isScoreable: boolean;
  domain: string;
  subDomain: string;
  kpi: string;
  indicator: string;
  averageSeverity: number | null;
  validCount: number;
  excludedCount: number;
  dontKnowCount: number;
  notApplicableCount: number;
  methodologyVersion: string;
  optionsDistribution: Array<{
    optionId: string;
    label: string;
    count: number;
  }>;
  lookups: Array<{
    optionId: string | null;
    lookupType: string;
    severityScore: number | null;
    isExcluded: boolean;
    exclusionReason: string | null;
  }>;
  calculatedAt: string;
}

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

export interface VillagePriorityResult {
  priorityScore: number;
  priorityStatus: "HIGH" | "MEDIUM" | "LOW";
  overrideApplied: boolean;
  overrideReason: string | null;
  domainComponents: DomainPriorityComponent[];
  calculatedAt: string;
  calculationVersion: string;
  methodologyVersion: string;
}

export type RecalculateReason =
  | "SURVEY_NOT_FOUND"
  | "NO_RESPONSES"
  | "NO_METHODOLOGY_VERSION"
  | "NO_DOMAIN_PRIORITY_CONFIG"
  | "NO_DOMAIN_ROLLUPS";

export interface RecalculateResult {
  success: boolean;
  reason?: RecalculateReason;
}

export const severityScoringService = {
  async listMethodologyVersions(): Promise<MethodologyVersion[]> {
    return apiClient.get<MethodologyVersion[]>("/methodology-versions");
  },

  async createMethodologyVersion(payload: {
    name: string;
    version: string;
    description?: string;
  }): Promise<MethodologyVersion> {
    return apiClient.post<MethodologyVersion>("/methodology-versions", payload);
  },

  async uploadLookups(versionId: string, file: File): Promise<{ imported: number }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<{ imported: number }>(
      `/methodology-versions/${versionId}/upload-lookups`,
      formData,
    );
  },

  async getDashboard(
    studyId: string,
    surveyId: string,
    villageId: string | null = null,
  ): Promise<SeverityDashboardResult> {
    const query = villageId ? `?villageId=${encodeURIComponent(villageId)}` : "";
    return apiClient.get<SeverityDashboardResult>(
      `/studies/${studyId}/surveys/${surveyId}/severity-dashboard${query}`,
    );
  },

  async getKpiRankings(
    studyId: string,
    surveyId: string,
    villageId: string | null = null,
  ): Promise<SeverityKpiRankingEntry[]> {
    const query = villageId ? `?villageId=${encodeURIComponent(villageId)}` : "";
    return apiClient.get<SeverityKpiRankingEntry[]>(
      `/studies/${studyId}/surveys/${surveyId}/severity-kpis${query}`,
    );
  },

  async getQuestionDetail(
    studyId: string,
    surveyId: string,
    questionId: string,
    villageId: string | null = null,
  ): Promise<QuestionDetailResult> {
    const query = villageId ? `?villageId=${encodeURIComponent(villageId)}` : "";
    return apiClient.get<QuestionDetailResult>(
      `/studies/${studyId}/surveys/${surveyId}/questions/${encodeURIComponent(questionId)}${query}`,
    );
  },

  async getVillagePriority(
    studyId: string,
    surveyId: string,
    villageId: string | null = null,
    options?: RequestOptions,
  ): Promise<VillagePriorityResult | null> {
    const query = villageId ? `?villageId=${encodeURIComponent(villageId)}` : "";
    return apiClient.get<VillagePriorityResult | null>(
      `/studies/${studyId}/surveys/${surveyId}/village-priority${query}`,
      options,
    );
  },

  /** `reason` is present only when `success` is false — the backend's
   * recalculation pipeline has several legitimate "nothing to compute"
   * exits (no responses submitted yet, methodology reference data missing
   * for the survey's version, no domain rollups matching the configured
   * domains) and reports which one it hit so the caller can say so instead
   * of leaving the Priority Score panel unchanged with no explanation. */
  async recalculate(
    studyId: string,
    surveyId: string,
    options?: RequestOptions,
  ): Promise<RecalculateResult> {
    return apiClient.post<RecalculateResult>(
      `/studies/${studyId}/surveys/${surveyId}/recalculate`,
      {},
      options,
    );
  },
};
