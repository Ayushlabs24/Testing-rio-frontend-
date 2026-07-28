import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { reportsService } from "@/services/reports/reports.service";

vi.mock("@/services/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), download: vi.fn() },
}));

describe("reportsService.download()", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(apiClient.download).mockReset();
    createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it("goes through apiClient.download with the export path and a PDF default filename", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    vi.mocked(apiClient.download).mockResolvedValue({ blob, filename: "report.pdf" });

    await reportsService.download("report_1", "pdf");

    expect(apiClient.download).toHaveBeenCalledWith(
      endpoints.reports.export("report_1", "pdf"),
      "report.pdf",
    );
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("defaults to an .xlsx filename for the excel format", async () => {
    vi.mocked(apiClient.download).mockResolvedValue({
      blob: new Blob(),
      filename: "report.xlsx",
    });

    await reportsService.download("report_1", "excel");

    expect(apiClient.download).toHaveBeenCalledWith(
      endpoints.reports.export("report_1", "excel"),
      "report.xlsx",
    );
  });

  it("uses the filename apiClient.download resolves from Content-Disposition", async () => {
    vi.mocked(apiClient.download).mockResolvedValue({
      blob: new Blob(),
      filename: "RPT01-village-a-2026.pdf",
    });

    await reportsService.download("report_1", "pdf");

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("RPT01-village-a-2026.pdf");
  });

  it("propagates a download failure instead of silently swallowing it", async () => {
    vi.mocked(apiClient.download).mockRejectedValue(new Error("network error"));

    await expect(reportsService.download("report_1", "pdf")).rejects.toThrow(
      "network error",
    );
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
