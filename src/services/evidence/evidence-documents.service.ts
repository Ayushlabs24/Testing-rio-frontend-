import { apiClient } from "@/services/api/client";

export interface EvidenceDocument {
  id: string;
  orgId: string;
  studyId: string;
  uploadedBy: string;
  title: string;
  fileName: string;
  fileType: string;
  storageKey: string;
  documentType: string;
  sourceReferenceId: string;
  collectedDate: string;
  description?: string | null;
  linkedNeedId?: string | null;
  linkedDomainId?: string | null;
  linkedKpiId?: string | null;
  parsingStatus: "UPLOADED" | "PARSING" | "PARSED" | "FAILED";
  extractedText?: string | null;
  parsedAt?: string | null;
  parseError?: string | null;
  isIncludedInCombinedReport: boolean;
  createdAt: string;
  updatedAt: string;
  chunks?: EvidenceDocumentChunk[];
  summaries?: EvidenceDocumentSummary[];
}

export interface EvidenceDocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber?: number | null;
  sectionReference?: string | null;
  chunkText: string;
  chunkSummary?: string | null;
}

export interface EvidenceDocumentSummary {
  id: string;
  documentId: string;
  studyId: string;
  status: "DRAFT" | "OFFICER_CONFIRMED" | "STALE" | "SUPERSEDED";
  promptVersion: string;
  modelName: string;
  modelVersion: string;
  inputTextHash: string;
  aiOutputJson: Record<string, unknown>;
  officerEditedOutputJson?: Record<string, unknown> | null;
  generatedBy: string;
  generatedAt: string;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
}

export class EvidenceDocumentsService {
  async uploadDocument(studyId: string, formData: FormData): Promise<EvidenceDocument> {
    return apiClient.post<EvidenceDocument>(
      `/studies/${studyId}/evidence-documents`,
      formData,
    );
  }

  async listDocuments(
    studyId: string,
    params?: { search?: string; documentType?: string; linkedDomainId?: string },
  ): Promise<EvidenceDocument[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.documentType) query.append("documentType", params.documentType);
    if (params?.linkedDomainId) query.append("linkedDomainId", params.linkedDomainId);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get<EvidenceDocument[]>(
      `/studies/${studyId}/evidence-documents${queryString}`,
    );
  }

  async getDocumentDetails(studyId: string, id: string): Promise<EvidenceDocument> {
    return apiClient.get<EvidenceDocument>(
      `/studies/${studyId}/evidence-documents/${id}`,
    );
  }

  /**
   * Fetches the original uploaded file as a blob. Goes through `downloadBlob`
   * rather than pointing an anchor at the URL directly because the API is on a
   * different origin than the app, so the session cookie only rides along on a
   * `credentials: "include"` fetch.
   */
  async getDocumentFileBlob(studyId: string, id: string): Promise<Blob> {
    return apiClient.downloadBlob(`/studies/${studyId}/evidence-documents/${id}/file`);
  }

  async toggleInclusion(
    studyId: string,
    id: string,
    isIncluded: boolean,
  ): Promise<EvidenceDocument> {
    return apiClient.patch<EvidenceDocument>(
      `/studies/${studyId}/evidence-documents/${id}/inclusion`,
      { isIncluded },
    );
  }

  async deleteDocument(studyId: string, id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(
      `/studies/${studyId}/evidence-documents/${id}`,
    );
  }

  async generateDocumentSummary(
    studyId: string,
    id: string,
  ): Promise<EvidenceDocumentSummary> {
    return apiClient.post<EvidenceDocumentSummary>(
      `/studies/${studyId}/evidence-documents/${id}/summary/generate`,
      {},
      { timeoutMs: 120000 },
    );
  }

  async updateDocumentSummary(
    studyId: string,
    id: string,
    summaryId: string,
    body: Record<string, unknown>,
  ): Promise<EvidenceDocumentSummary> {
    return apiClient.put<EvidenceDocumentSummary>(
      `/studies/${studyId}/evidence-documents/${id}/summary/${summaryId}`,
      body,
    );
  }

  async confirmDocumentSummary(
    studyId: string,
    id: string,
    summaryId: string,
  ): Promise<EvidenceDocumentSummary> {
    return apiClient.post<EvidenceDocumentSummary>(
      `/studies/${studyId}/evidence-documents/${id}/summary/${summaryId}/confirm`,
      {},
    );
  }
}

export const evidenceDocumentsService = new EvidenceDocumentsService();
