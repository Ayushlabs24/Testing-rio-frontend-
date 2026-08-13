import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  BulkImportNeedItem,
  CreateNeedPayload,
  ImportNeedsResult,
  Need,
  PdfPreviewResult,
  UpdateNeedPayload,
} from "@/services/needs/needs.types";

export const needsService = {
  /** Every Need under a Study — a Study can hold many now. */
  async listByStudy(studyId: string): Promise<Need[]> {
    return apiClient.get<Need[]>(endpoints.needs.forStudy(studyId));
  },

  async getById(needId: string): Promise<Need> {
    return apiClient.get<Need>(endpoints.needs.byId(needId));
  },

  async create(studyId: string, payload: CreateNeedPayload): Promise<Need> {
    return apiClient.post<Need>(endpoints.needs.forStudy(studyId), payload);
  },

  async update(needId: string, payload: UpdateNeedPayload): Promise<Need> {
    return apiClient.patch<Need>(endpoints.needs.byId(needId), payload);
  },

  /** Only while the Need is still `draft` — the backend rejects (409)
   * anything past that, same rule as editing. */
  async remove(needId: string): Promise<void> {
    await apiClient.delete(endpoints.needs.byId(needId));
  },

  /** CSV/XLSX only — one Need per row. PDF isn't parsed here; attach it as
   * Evidence on a manually created Need instead. Duplicate rows (by
   * Reference ID, or Title + Governorate, against this Study's existing
   * Needs) are skipped automatically — see each error's `type` in the
   * response to tell a skipped duplicate apart from a real validation
   * failure. */
  async importFromFile(studyId: string, file: File): Promise<ImportNeedsResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.uploadForm<ImportNeedsResult>(
      endpoints.needs.import(studyId),
      formData,
    );
  },

  async previewPdfFromFile(studyId: string, file: File): Promise<PdfPreviewResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.uploadForm<PdfPreviewResult>(
      endpoints.needs.previewPdf(studyId),
      formData,
    );
  },

  async previewSurveyResultsFromFile(
    studyId: string,
    file: File,
  ): Promise<PdfPreviewResult> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.uploadForm<PdfPreviewResult>(
      endpoints.needs.previewSurveyResults(studyId),
      formData,
    );
  },

  /** Bulk-create Needs from a pre-parsed list of items (AI-extracted from a
   * PDF or survey results file).  Duplicate detection and validation errors
   * are handled by the backend — see `ImportNeedsResult.errors`. */
  async importBulkNeeds(
    studyId: string,
    items: BulkImportNeedItem[],
  ): Promise<ImportNeedsResult> {
    return apiClient.post<ImportNeedsResult>(endpoints.needs.importBulk(studyId), {
      needs: items,
    });
  },
};
