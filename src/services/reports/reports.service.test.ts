import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportsService } from "@/services/reports/reports.service";

/**
 * download() bypasses apiClient entirely (binary response, not JSON) and
 * triggers a real browser download — same shape as auditService.downloadCsv
 * (see audit.service.test.ts), just keyed by report id + ExportFormat
 * instead of date-range filters.
 */
describe("reportsService.download", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.unstubAllGlobals();
  });

  function mockFetchResponse({
    ok = true,
    status = 200,
    statusText = "OK",
    disposition,
    body,
  }: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    disposition?: string;
    body?: unknown;
  } = {}) {
    const headers = new Headers();
    if (disposition) headers.set("content-disposition", disposition);
    const blob = new Blob(["binary-content"], { type: "application/octet-stream" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok,
        status,
        statusText,
        headers,
        blob: vi.fn().mockResolvedValue(blob),
        json: vi.fn().mockResolvedValue(body),
      }),
    );
  }

  /** Creates a real anchor (jsdom rejects `href`/`download` on a faked prototype) with `click` spied. */
  function spyOnAnchorClick() {
    const clickSpy = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = clickSpy;
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);
    return { anchor, clickSpy };
  }

  it("downloads a PDF export and triggers a browser save via an anchor click", async () => {
    mockFetchResponse({ disposition: 'attachment; filename="village-report.pdf"' });
    const { anchor, clickSpy } = spyOnAnchorClick();

    await reportsService.download("report-1", "pdf");

    const [calledUrl, calledInit] = vi.mocked(global.fetch).mock.calls[0];
    const url = calledUrl as URL;
    expect(url.pathname).toBe("/api/reports/report-1/export");
    expect(url.searchParams.get("format")).toBe("pdf");
    expect(calledInit).toEqual({ credentials: "include" });
    expect(anchor.download).toBe("village-report.pdf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("downloads an Excel export using the excel format param", async () => {
    mockFetchResponse({ disposition: 'attachment; filename="village-report.xlsx"' });
    const { anchor, clickSpy } = spyOnAnchorClick();

    await reportsService.download("report-1", "excel");

    const [calledUrl] = vi.mocked(global.fetch).mock.calls[0];
    expect((calledUrl as URL).searchParams.get("format")).toBe("excel");
    expect(anchor.download).toBe("village-report.xlsx");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to a default 'report.pdf' filename when no content-disposition header is present", async () => {
    mockFetchResponse({});
    const { anchor } = spyOnAnchorClick();

    await reportsService.download("report-1", "pdf");

    expect(anchor.download).toBe("report.pdf");
  });

  it("falls back to a default 'report.xlsx' filename for excel when no content-disposition header is present", async () => {
    mockFetchResponse({});
    const { anchor } = spyOnAnchorClick();

    await reportsService.download("report-1", "excel");

    expect(anchor.download).toBe("report.xlsx");
  });

  it("throws with the server's parsed error message when the export request fails", async () => {
    mockFetchResponse({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      body: { error: { message: "RPT08 doesn't support pdf export." } },
    });

    await expect(reportsService.download("report-1", "pdf")).rejects.toThrow(
      "RPT08 doesn't support pdf export.",
    );
  });

  it("falls back to the response status text when the error body can't be parsed as JSON", async () => {
    const headers = new Headers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers,
        json: vi.fn().mockRejectedValue(new Error("not json")),
      }),
    );

    await expect(reportsService.download("report-1", "pdf")).rejects.toThrow(
      "Internal Server Error",
    );
  });
});
