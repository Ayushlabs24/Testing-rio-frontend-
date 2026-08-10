import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api/client";
import { systemLogsService } from "@/services/system-logs/system-logs.service";

/**
 * RIO-NFR-016. The service is a thin, read-only passthrough — filtering,
 * pagination and redaction all live server-side (see the backend's
 * system-logs.service.spec.ts). What matters here is that the query string
 * it builds is the one the API expects, and that empty filters never leak
 * into it as `?level=`.
 */
vi.mock("@/services/api/client", () => ({
  apiClient: { get: vi.fn(), downloadBlob: vi.fn() },
}));

describe("systemLogsService", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.downloadBlob).mockReset();
  });

  it("passes filters and pagination through as query params", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 0,
    });

    await systemLogsService.list({
      minLevel: "warn",
      category: "integration",
      organizationId: "org-1",
      search: "timeout",
      limit: 25,
      offset: 50,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/system-logs", {
      params: {
        minLevel: "warn",
        category: "integration",
        organizationId: "org-1",
        search: "timeout",
        limit: 25,
        offset: 50,
      },
    });
  });

  it("drops empty and undefined filters instead of sending blank params", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    await systemLogsService.list({ search: "", eventCode: undefined, level: "error" });

    expect(apiClient.get).toHaveBeenCalledWith("/system-logs", {
      params: { level: "error" },
    });
  });

  it("requests the summary for the given window", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ stats: {} });

    await systemLogsService.getSummary("7d");

    expect(apiClient.get).toHaveBeenCalledWith("/system-logs/summary", {
      params: { window: "7d" },
    });
  });

  it("defaults the summary window to 24h", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ stats: {} });

    await systemLogsService.getSummary();

    expect(apiClient.get).toHaveBeenCalledWith("/system-logs/summary", {
      params: { window: "24h" },
    });
  });

  it("unwraps the request trace envelope, and tolerates an empty response", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [{ id: "log-1" }] });
    await expect(systemLogsService.getByRequestId("req-1")).resolves.toEqual([
      { id: "log-1" },
    ]);
    expect(apiClient.get).toHaveBeenCalledWith("/system-logs/request/req-1");

    vi.mocked(apiClient.get).mockResolvedValue(undefined);
    await expect(systemLogsService.getByRequestId("req-2")).resolves.toEqual([]);
  });

  it("exports with the active filters, so the CSV matches what is on screen", async () => {
    const blob = new Blob(["csv"], { type: "text/csv" });
    vi.mocked(apiClient.downloadBlob).mockResolvedValue(blob);
    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    await systemLogsService.downloadCsv({ level: "error", category: "job", search: "" });

    expect(apiClient.downloadBlob).toHaveBeenCalledWith("/system-logs/export", {
      params: { level: "error", category: "job" },
    });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:url");
    vi.unstubAllGlobals();
  });
});
