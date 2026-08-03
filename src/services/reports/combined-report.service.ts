import { apiClient } from "@/services/api/client";

/** One selectable AI score-based summary belonging to a study. */
export interface ScoreSummaryOption {
  id: string;
  status: string;
  /** village | sector | region | executive — which level the summary covers. */
  summaryScope?: string | null;
  scopeFilters?: Record<string, unknown> | null;
  reportDataSnapshotId: string;
  promptVersion?: string;
  modelName?: string;
  aiOutputJson: Record<string, unknown>;
  officerEditedOutputJson?: Record<string, unknown> | null;
  generatedAt: string;
  officerConfirmedAt?: string | null;
}

export interface CombinedReportContext {
  study: {
    id: string;
    title: string;
    cycleNumber: number;
    orgName: string;
    methodologyVersion: string;
    region: string;
    governorate: string;
    documentCount: number;
  };
  /**
   * Every AI score summary generated for this study, newest first. The officer
   * picks one of these to combine. Empty when the study has none — the backend
   * does not substitute a placeholder.
   */
  availableScoreSummaries: ScoreSummaryOption[];
  /** The most recent score summary, or null when the study has none. */
  confirmedScoreSummary: ScoreSummaryOption | null;
  confirmedDocumentSummaries: {
    documentId: string;
    documentTitle: string;
    sourceReferenceId: string;
    documentType: string;
    linkedDomainId: string;
    linkedNeedId: string;
    confirmedSummary: {
      id: string;
      status: string;
      aiOutputJson: Record<string, unknown>;
      officerEditedOutputJson?: Record<string, unknown> | null;
      confirmedAt?: string | null;
    };
  }[];
  latestCombinedSummary: CombinedReportSummary | null;
}

export interface CombinedReportSummary {
  id: string;
  studyId: string;
  orgId: string;
  reportDataSnapshotId: string;
  scoreSummaryId: string;
  status: "DRAFT" | "OFFICER_CONFIRMED" | "STALE" | "SUPERSEDED";
  promptVersion: string;
  modelName: string;
  modelVersion: string;
  inputHash: string;
  aiOutputJson: Record<string, unknown>;
  officerEditedOutputJson?: Record<string, unknown> | null;
  generatedBy: string;
  generatedAt: string;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  sources?: {
    document: {
      id: string;
      title: string;
      sourceReferenceId: string;
      documentType: string;
    };
    documentSummary: { id: string; confirmedAt: string };
  }[];
}

export class CombinedReportService {
  async getContext(studyId: string): Promise<CombinedReportContext> {
    return apiClient.get<CombinedReportContext>(`/studies/${studyId}/combined-report`);
  }

  /**
   * `scoreSummaryId` selects which score summary to combine. Omitting it lets
   * the backend fall back to the study's most recent one.
   */
  async generateCombinedSummary(
    studyId: string,
    documentSummaryIds: string[],
    scoreSummaryId?: string,
  ): Promise<CombinedReportSummary> {
    return apiClient.post<CombinedReportSummary>(
      `/studies/${studyId}/combined-report/generate`,
      { documentSummaryIds, scoreSummaryId },
      { timeoutMs: 120000 },
    );
  }

  async updateCombinedSummary(
    studyId: string,
    summaryId: string,
    body: Record<string, unknown>,
  ): Promise<CombinedReportSummary> {
    return apiClient.put<CombinedReportSummary>(
      `/studies/${studyId}/combined-report/summary/${summaryId}`,
      body,
    );
  }

  async confirmCombinedSummary(
    studyId: string,
    summaryId: string,
  ): Promise<CombinedReportSummary> {
    return apiClient.post<CombinedReportSummary>(
      `/studies/${studyId}/combined-report/summary/${summaryId}/confirm`,
      {},
    );
  }
}

export const combinedReportService = new CombinedReportService();
