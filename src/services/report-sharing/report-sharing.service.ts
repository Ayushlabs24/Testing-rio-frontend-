import { apiClient } from "@/services/api/client";
import { apiConfig } from "@/services/api/config";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type {
  CreateReportSharingRequestPayload,
  DecideReportSharingRequestPayload,
  OrgLookupResult,
  ReportLookupResult,
  ReportSharingRequest,
  SharedReportSnapshot,
} from "@/services/report-sharing/report-sharing.types";
import type { ExportFormat } from "@/services/reports/reports.types";

export const reportSharingService = {
  async create(
    payload: CreateReportSharingRequestPayload,
  ): Promise<ReportSharingRequest> {
    return apiClient.post<ReportSharingRequest>(endpoints.reportSharing.create, payload);
  },
  async list(): Promise<ReportSharingRequest[]> {
    return apiClient.get<ReportSharingRequest[]>(endpoints.reportSharing.list);
  },
  async getById(id: string): Promise<ReportSharingRequest> {
    return apiClient.get<ReportSharingRequest>(endpoints.reportSharing.byId(id));
  },
  async approve(
    id: string,
    payload: DecideReportSharingRequestPayload = {},
  ): Promise<ReportSharingRequest> {
    return apiClient.patch<ReportSharingRequest>(
      endpoints.reportSharing.approve(id),
      payload,
    );
  },
  async reject(
    id: string,
    payload: DecideReportSharingRequestPayload = {},
  ): Promise<ReportSharingRequest> {
    return apiClient.patch<ReportSharingRequest>(
      endpoints.reportSharing.reject(id),
      payload,
    );
  },
  async getSharedReport(id: string): Promise<SharedReportSnapshot> {
    return apiClient.get<SharedReportSnapshot>(endpoints.reportSharing.sharedReport(id));
  },
  async lookupOrganizations(query: string): Promise<OrgLookupResult[]> {
    return apiClient.get<OrgLookupResult[]>(
      endpoints.reportSharing.lookupOrganizations(query),
    );
  },
  async lookupReportsForOrg(orgId: string): Promise<ReportLookupResult[]> {
    return apiClient.get<ReportLookupResult[]>(
      endpoints.reportSharing.lookupReportsForOrg(orgId),
    );
  },
  /** Same binary-download pattern as reportsService.download — bypasses
   * apiClient (JSON-only) and triggers a real browser download. */
  async download(id: string, format: ExportFormat): Promise<void> {
    const url = new URL(
      endpoints.reportSharing.export(id, format).replace(/^\//, ""),
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
