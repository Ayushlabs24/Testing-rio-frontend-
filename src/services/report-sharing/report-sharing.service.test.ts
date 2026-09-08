import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { reportSharingService } from "@/services/report-sharing/report-sharing.service";
import type {
  OrgLookupResult,
  ReportLookupResult,
  ReportSharingRequest,
  SharedReportSnapshot,
} from "@/services/report-sharing/report-sharing.types";

/**
 * This is a thin passthrough over apiClient — the actual authorization/org-
 * isolation/lifecycle rules live server-side (see Project-RIO-Backend's
 * report-sharing.service.spec.ts). Here we only verify the right endpoint
 * and payload are used, results/errors are passed through untouched, and
 * getSharedReport's response is never treated as anything but a read-only
 * snapshot (no export/download method exists on this service — see the "no
 * download method" note at the bottom of report-sharing.service.ts).
 */
vi.mock("@/services/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const REQUEST: ReportSharingRequest = {
  id: "rsr-1",
  ownerOrgId: "org-owner",
  ownerOrgName: "Owner NGO",
  requestingOrgId: "org-requester",
  requestingOrgName: "Requester NGO",
  reportId: "report-1",
  reportTitle: "Village Needs Assessment",
  status: "pending",
  requestedBy: "user-1",
  requestedAt: "2026-07-01T00:00:00.000Z",
  decidedBy: null,
  decidedAt: null,
  note: "For reference",
  decisionNote: null,
  expiresAt: null,
  withdrawnBy: null,
  withdrawnAt: null,
};

describe("reportSharingService", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it("create() posts the payload to the create endpoint and returns the created request", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(REQUEST);

    const payload = {
      ownerOrgId: "org-owner",
      reportId: "report-1",
      note: "For reference",
    };
    const result = await reportSharingService.create(payload);

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.reportSharing.create, payload);
    expect(result).toEqual(REQUEST);
  });

  it("create() propagates a rejection from apiClient", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("CANNOT_REQUEST_OWN_REPORT"));

    await expect(
      reportSharingService.create({
        ownerOrgId: "org-owner",
        reportId: "report-1",
        note: "why",
      }),
    ).rejects.toThrow("CANNOT_REQUEST_OWN_REPORT");
  });

  it("list() returns the array of requests as-is", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([REQUEST]);

    const result = await reportSharingService.list();

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.reportSharing.list);
    expect(result).toEqual([REQUEST]);
  });

  it("list() returns an empty array when there are no requests", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const result = await reportSharingService.list();

    expect(result).toEqual([]);
  });

  it("getById() fetches a single request by id", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(REQUEST);

    const result = await reportSharingService.getById("rsr-1");

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.reportSharing.byId("rsr-1"));
    expect(result).toEqual(REQUEST);
  });

  it("getById() propagates a not-found rejection", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      new Error("REPORT_SHARING_REQUEST_NOT_FOUND"),
    );

    await expect(reportSharingService.getById("missing")).rejects.toThrow(
      "REPORT_SHARING_REQUEST_NOT_FOUND",
    );
  });

  it("approve() patches with no payload when none is given", async () => {
    const approved = { ...REQUEST, status: "approved" as const, decidedBy: "user-2" };
    vi.mocked(apiClient.patch).mockResolvedValue(approved);

    const result = await reportSharingService.approve("rsr-1");

    expect(apiClient.patch).toHaveBeenCalledWith(
      endpoints.reportSharing.approve("rsr-1"),
      {},
    );
    expect(result).toEqual(approved);
  });

  it("approve() forwards an optional note payload", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(REQUEST);

    await reportSharingService.approve("rsr-1", { note: "Looks good" });

    expect(apiClient.patch).toHaveBeenCalledWith(
      endpoints.reportSharing.approve("rsr-1"),
      {
        note: "Looks good",
      },
    );
  });

  it("reject() patches with no payload when none is given", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      ...REQUEST,
      status: "rejected" as const,
    });

    await reportSharingService.reject("rsr-1");

    expect(apiClient.patch).toHaveBeenCalledWith(
      endpoints.reportSharing.reject("rsr-1"),
      {},
    );
  });

  it("reject() forwards the required reason as the note payload", async () => {
    const rejected = {
      ...REQUEST,
      status: "rejected" as const,
      decisionNote: "Doesn't match our scope",
    };
    vi.mocked(apiClient.patch).mockResolvedValue(rejected);

    const result = await reportSharingService.reject("rsr-1", {
      note: "Doesn't match our scope",
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      endpoints.reportSharing.reject("rsr-1"),
      {
        note: "Doesn't match our scope",
      },
    );
    expect(result.decisionNote).toBe("Doesn't match our scope");
  });

  it("getSharedReport() returns the read-only snapshot with no export-capable fields", async () => {
    const snapshot: SharedReportSnapshot = {
      reportId: "report-1",
      title: "Village Needs Assessment",
      reportType: "RPT14",
      content: { summary: "..." },
      generatedAt: "2026-07-01T00:00:00.000Z",
      ownerOrgName: "Owner NGO",
      generatedByName: "Owner Staffer",
      officerConfirmedBy: null,
      officerConfirmedAt: null,
      reviewedBy: null,
      reviewedAt: null,
    };
    vi.mocked(apiClient.get).mockResolvedValue(snapshot);

    const result = await reportSharingService.getSharedReport("rsr-1");

    expect(apiClient.get).toHaveBeenCalledWith(
      endpoints.reportSharing.sharedReport("rsr-1"),
    );
    expect(result).toEqual(snapshot);
    // No download/export/url-like field is part of the snapshot's contract —
    // a shared report is view-only (see report-sharing.service.ts's comment).
    expect(Object.keys(result)).not.toContain("downloadUrl");
    expect(Object.keys(result)).not.toContain("exportFormats");
  });

  it("getSharedReport() propagates a not-approved rejection", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("SHARING_NOT_APPROVED"));

    await expect(reportSharingService.getSharedReport("rsr-1")).rejects.toThrow(
      "SHARING_NOT_APPROVED",
    );
  });

  it("lookupOrganizations() forwards the query string", async () => {
    const orgs: OrgLookupResult[] = [{ id: "org-requester", name: "Requester NGO" }];
    vi.mocked(apiClient.get).mockResolvedValue(orgs);

    const result = await reportSharingService.lookupOrganizations("requester");

    expect(apiClient.get).toHaveBeenCalledWith(
      endpoints.reportSharing.lookupOrganizations("requester"),
    );
    expect(result).toEqual(orgs);
  });

  it("lookupOrganizations() handles an empty query and an empty result", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const result = await reportSharingService.lookupOrganizations("");

    expect(apiClient.get).toHaveBeenCalledWith(
      endpoints.reportSharing.lookupOrganizations(""),
    );
    expect(result).toEqual([]);
  });

  it("lookupReportsForOrg() forwards the owner org id", async () => {
    const reports: ReportLookupResult[] = [
      { id: "report-1", title: "Village Needs Assessment" },
    ];
    vi.mocked(apiClient.get).mockResolvedValue(reports);

    const result = await reportSharingService.lookupReportsForOrg("org-owner");

    expect(apiClient.get).toHaveBeenCalledWith(
      endpoints.reportSharing.lookupReportsForOrg("org-owner"),
    );
    expect(result).toEqual(reports);
  });

  it("lookupReportsForOrg() returns an empty array when the org has no eligible reports", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    const result = await reportSharingService.lookupReportsForOrg("org-owner");

    expect(result).toEqual([]);
  });
});
