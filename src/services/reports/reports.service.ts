import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateReportPayload,
  ExportFormat,
  ListReportsParams,
  Report,
} from "@/services/reports/reports.types";

export const reportsService = {
  async create(payload: CreateReportPayload): Promise<Report> {
    return apiClient.post<Report>(endpoints.reports.create, payload);
  },
  async list(params: ListReportsParams = {}): Promise<Report[]> {
    return apiClient.get<Report[]>(endpoints.reports.list, {
      params: {
        reportType: params.reportType,
        status: params.status,
        studyId: params.studyId,
        surveyId: params.surveyId,
      },
    });
  },
  async getById(id: string): Promise<Report> {
    return apiClient.get<Report>(endpoints.reports.byId(id));
  },
  async confirm(id: string): Promise<Report> {
    return apiClient.patch<Report>(endpoints.reports.confirm(id));
  },
  // Notes mandatory (RIO-FR-007 clarification: extends to all four report
  // categories, not just the NCNP Compiled Report).
  async approve(id: string, notes: string): Promise<Report> {
    return apiClient.patch<Report>(endpoints.reports.approve(id), { notes });
  },
  async reject(id: string, notes: string): Promise<Report> {
    return apiClient.patch<Report>(endpoints.reports.reject(id), { notes });
  },
  async archive(id: string): Promise<Report> {
    return apiClient.patch<Report>(endpoints.reports.archive(id));
  },
  /**
   * Export returns a binary file, not JSON — goes through apiClient.download
   * (blob handling, not response.json()) and triggers a real browser
   * download from the result. The placeholder stub today has the same
   * content-type/filename contract the real PDF/Excel export will have
   * later, so this download path doesn't change when that lands.
   */
  async download(id: string, format: ExportFormat, locale?: "en" | "ar"): Promise<void> {
    const { blob, filename } = await apiClient.download(
      endpoints.reports.export(id, format, locale),
      `report.${format === "pdf" ? "pdf" : "xlsx"}`,
    );

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
