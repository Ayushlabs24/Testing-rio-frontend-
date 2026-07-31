import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { NcnpReport } from "@/services/ncnp-report/ncnp-report.types";

export const ncnpReportService = {
  async get(periodDays?: number, dormantDays?: number): Promise<NcnpReport> {
    const params = new URLSearchParams();
    if (periodDays) params.set("periodDays", String(periodDays));
    if (dormantDays) params.set("dormantDays", String(dormantDays));
    const query = params.toString();
    return apiClient.get<NcnpReport>(
      query ? `${endpoints.ncnpReport.get}?${query}` : endpoints.ncnpReport.get,
    );
  },
  /** Same download-and-save-as pattern reportsService.download already
   * uses — real binary response (PDF/Excel), not JSON. */
  async download(format: "pdf" | "excel"): Promise<void> {
    const { blob, filename } = await apiClient.download(
      endpoints.ncnpReport.export(format),
      `ncnp-consolidated-report.${format === "pdf" ? "pdf" : "xlsx"}`,
    );
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
