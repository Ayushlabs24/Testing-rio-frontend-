import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateReportSharingRequestPayload,
  DecideReportSharingRequestPayload,
  OrgLookupResult,
  ReportLookupResult,
  ReportSharingRequest,
  SharedReportSnapshot,
} from "@/services/report-sharing/report-sharing.types";

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
  async withdraw(id: string): Promise<ReportSharingRequest> {
    return apiClient.patch<ReportSharingRequest>(
      endpoints.reportSharing.withdraw(id),
      {},
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
  // Deliberately no download/export method here — a shared report is
  // view-only (see getSharedReport above); the backend no longer exposes an
  // export route for it at all (ReportSharingController's `:id/export` was
  // removed). The owning org's own report export stays on reportsService.
};
