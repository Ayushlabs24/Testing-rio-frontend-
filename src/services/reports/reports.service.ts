import { apiClient } from "@/services/api/client";
import { apiConfig } from "@/services/api/config";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
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
      },
    });
  },
  async getById(id: string): Promise<Report> {
    return apiClient.get<Report>(endpoints.reports.byId(id));
  },
  async approve(id: string): Promise<Report> {
    return apiClient.patch<Report>(endpoints.reports.approve(id));
  },
  async reject(id: string): Promise<Report> {
    return apiClient.patch<Report>(endpoints.reports.reject(id));
  },
  /**
   * Export returns a binary file, not JSON — bypasses apiClient (which
   * assumes a JSON response body) and triggers a real browser download from
   * the Blob response. The placeholder stub today has the same
   * content-type/filename contract the real PDF/Excel export will have
   * later, so this download path doesn't change when that lands.
   */
  async download(id: string, format: ExportFormat): Promise<void> {
    const url = new URL(
      endpoints.reports.export(id, format).replace(/^\//, ""),
      `${apiConfig.baseUrl}/`,
    );
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => undefined);
      throw new ApiError({
        message: payload?.error?.message ?? response.statusText,
        status: response.status,
      });
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = /filename="([^"]+)"/.exec(disposition);
    const filename = filenameMatch?.[1] ?? `report.${format === "pdf" ? "pdf" : "xlsx"}`;

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
