import { apiClient } from "@/services/api/client";

export type SummaryScopeType = "VILLAGE" | "SECTOR" | "REGION" | "EXECUTIVE";

export interface ScopeFilters {
  villageId?: string;
  domainKey?: string;
  regionId?: string;
  villageIds?: string[];
}

export interface PrioritySummaryOutput {
  executiveSummary: string;
  priorityExplanation: string;
  keyFindings: Array<{
    title: string;
    domain: string;
    kpi: string;
    severityScore: number | null;
    confidence: string;
    summary: string;
  }>;
  domainInsights: Array<{
    domain: string;
    severityScore: number | null;
    performanceScore: number | null;
    priorityContribution: number | null;
    confidence: string;
    summary: string;
  }>;
  criticalOverrideNote: string | null;
  dataQualityNote: string;
  evidenceSummary: Array<{
    evidenceTitle: string;
    sourceReferenceId: string;
    linkedDomainOrKpi: string;
    summary: string;
  }>;
  trendNote: string;
  draftNextSteps: string[];
}

export interface PrioritySummaryRecord {
  id: string;
  orgId: string;
  studyId: string;
  surveyId: string;
  villageId: string;
  reportDataSnapshotId: string;
  status: "DRAFT" | "SAVED" | "OFFICER_CONFIRMED" | "STALE" | "SUPERSEDED";
  summaryScope: SummaryScopeType;
  scopeFilters?: ScopeFilters;
  promptVersion: string;
  promptHash: string;
  modelName: string;
  modelVersion: string;
  inputReportDataHash: string;
  inputEvidenceSnapshotHash: string;
  aiOutputJson: PrioritySummaryOutput;
  officerEditedOutputJson: PrioritySummaryOutput | null;
  generatedBy: string;
  generatedAt: string;
  officerConfirmedBy: string | null;
  officerConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrioritySummaryResponse {
  summary: PrioritySummaryRecord | null;
  snapshot: Record<string, unknown>;
}

export const prioritySummaryService = {
  async previewSnapshot(
    studyId: string,
    surveyId: string,
    scope: SummaryScopeType = "VILLAGE",
    scopeFilters: ScopeFilters = {},
  ): Promise<{ snapshot: Record<string, unknown> }> {
    return apiClient.post(
      `/studies/${studyId}/surveys/${surveyId}/priority-summary/preview-snapshot`,
      { scope, scopeFilters },
    );
  },

  async generateSummary(
    studyId: string,
    surveyId: string,
    scope: SummaryScopeType = "VILLAGE",
    scopeFilters: ScopeFilters = {},
  ): Promise<PrioritySummaryResponse> {
    return apiClient.post<PrioritySummaryResponse>(
      `/studies/${studyId}/surveys/${surveyId}/priority-summary/generate`,
      { scope, scopeFilters },
    );
  },

  async getSummary(
    studyId: string,
    surveyId: string,
    scope: SummaryScopeType = "VILLAGE",
    villageId: string = "",
  ): Promise<PrioritySummaryResponse | null> {
    return apiClient.get<PrioritySummaryResponse | null>(
      `/studies/${studyId}/surveys/${surveyId}/priority-summary`,
      { params: { scope, villageId } },
    );
  },

  async saveDraftEdits(
    summaryId: string,
    editedOutputJson: PrioritySummaryOutput,
  ): Promise<PrioritySummaryRecord> {
    return apiClient.patch<PrioritySummaryRecord>(`/priority-summaries/${summaryId}`, {
      editedOutputJson,
    });
  },

  async confirmSummary(summaryId: string): Promise<PrioritySummaryRecord> {
    return apiClient.post<PrioritySummaryRecord>(
      `/priority-summaries/${summaryId}/confirm`,
    );
  },

  async getSummaryHistory(
    studyId: string,
    surveyId: string,
    scope: SummaryScopeType = "VILLAGE",
  ): Promise<PrioritySummaryRecord[]> {
    return apiClient.get<PrioritySummaryRecord[]>(
      `/studies/${studyId}/surveys/${surveyId}/priority-summary/history`,
      { params: { scope } },
    );
  },

  async toggleEvidenceInclusion(
    evidenceId: string,
    isIncludedInReport: boolean,
  ): Promise<Record<string, unknown>> {
    return apiClient.patch(`/evidence/${evidenceId}/toggle-inclusion`, {
      isIncludedInReport,
    });
  },

  async saveReportFromSummary(summaryId: string): Promise<Record<string, unknown>> {
    return apiClient.post(`/priority-summaries/${summaryId}/save-report`);
  },

  async saveSummary(
    summaryId: string,
    editedOutputJson?: PrioritySummaryOutput,
  ): Promise<PrioritySummaryRecord> {
    return apiClient.post<PrioritySummaryRecord>(
      `/priority-summaries/${summaryId}/save`,
      { editedOutputJson },
    );
  },

  async getSavedSummariesList(
    studyId: string,
    surveyId: string,
  ): Promise<PrioritySummaryRecord[]> {
    return apiClient.get<PrioritySummaryRecord[]>(
      `/studies/${studyId}/surveys/${surveyId}/priority-summaries/saved`,
    );
  },

  async deleteSavedSummary(summaryId: string): Promise<Record<string, unknown>> {
    return apiClient.delete(`/priority-summaries/${summaryId}`);
  },
};
