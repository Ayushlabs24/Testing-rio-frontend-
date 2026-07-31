import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";

export type NcnpReportReviewStatus = "draft" | "approved" | "rejected" | "released";

export interface NcnpReportReviewSummary {
  id: string;
  status: NcnpReportReviewStatus;
  filters: Record<string, unknown>;
  generatedBy: string;
  generatedByName: string | null;
  generatedAt: string;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  publishedBy: string | null;
  publishedByName: string | null;
  publishedAt: string | null;
}

export interface NcnpReportReviewDetail extends NcnpReportReviewSummary {
  content: Record<string, unknown>;
}

export interface NcnpReportReviewAlert {
  id: string;
  type: "ncnp_report_pending_review" | "ncnp_report_ready_to_publish";
  generatedAt: string;
}

export const ncnpReportReviewService = {
  /** System Admin: snapshot the current NCNP Compiled Report for review. */
  async generate(
    periodDays?: number,
    dormantDays?: number,
  ): Promise<NcnpReportReviewSummary> {
    return apiClient.post<NcnpReportReviewSummary>(endpoints.ncnpReportReview.generate, {
      periodDays,
      dormantDays,
    });
  },

  async list(status?: string): Promise<NcnpReportReviewSummary[]> {
    return apiClient.get<NcnpReportReviewSummary[]>(
      endpoints.ncnpReportReview.list(status),
    );
  },

  async getById(id: string): Promise<NcnpReportReviewDetail> {
    return apiClient.get<NcnpReportReviewDetail>(endpoints.ncnpReportReview.byId(id));
  },

  /** System Reviewer only. Reviewer notes are mandatory — enforced both
   * here (the shared reason dialog) and again on the backend. */
  async approve(id: string, notes: string): Promise<NcnpReportReviewSummary> {
    return apiClient.patch<NcnpReportReviewSummary>(
      endpoints.ncnpReportReview.approve(id),
      { notes },
    );
  },

  async reject(id: string, notes: string): Promise<NcnpReportReviewSummary> {
    return apiClient.patch<NcnpReportReviewSummary>(
      endpoints.ncnpReportReview.reject(id),
      { notes },
    );
  },

  /** System Admin only. No notes required — client spec only mandates
   * notes for Approve/Reject. */
  async publish(id: string): Promise<NcnpReportReviewSummary> {
    return apiClient.patch<NcnpReportReviewSummary>(
      endpoints.ncnpReportReview.publish(id),
      {},
    );
  },

  async listAlerts(): Promise<NcnpReportReviewAlert[]> {
    return apiClient.get<NcnpReportReviewAlert[]>(endpoints.ncnpReportReview.alerts);
  },

  /** Exports this specific review's frozen snapshot (with a full Audit
   * Trail) — not the always-live current data `ncnpReportService.download`
   * fetches. Only reachable once Released, same rule the UI enforces. */
  async download(id: string, format: "pdf" | "excel"): Promise<void> {
    const { blob, filename } = await apiClient.download(
      endpoints.ncnpReportReview.export(id, format),
      `ncnp-compiled-report.${format === "pdf" ? "pdf" : "xlsx"}`,
    );
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  },
};
