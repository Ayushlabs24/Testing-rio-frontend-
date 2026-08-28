import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  ConfirmBatchResult,
  NeedSummary,
  PendingNeedSummaries,
} from "@/services/needs/need-summary.types";

/** RIO-AI-003. Note there is no `generate` — the summary is suggested
 *  automatically by the backend when a long need is written, from every entry
 *  point. `regenerate` is the only user-initiated way to produce one. */
export const needSummaryService = {
  /** Null when this need has no live summary — either its description is below
   *  the threshold, or generation has not run yet. */
  async getForNeed(needId: string, signal?: AbortSignal): Promise<NeedSummary | null> {
    return apiClient.get<NeedSummary | null>(endpoints.needSummaries.forNeed(needId), {
      signal,
    });
  },

  async regenerate(needId: string): Promise<NeedSummary> {
    return apiClient.post<NeedSummary>(endpoints.needSummaries.regenerate(needId));
  },

  async listPending(
    params: { limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<PendingNeedSummaries> {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    const qs = query.toString();
    return apiClient.get<PendingNeedSummaries>(
      qs ? `${endpoints.needSummaries.pending}?${qs}` : endpoints.needSummaries.pending,
      { signal },
    );
  },

  /** Saves the reviewer's edit. The backend writes a separate column, so the
   *  model's original text survives this call. */
  async updateDraft(summaryId: string, summaryText: string): Promise<NeedSummary> {
    return apiClient.patch<NeedSummary>(endpoints.needSummaries.byId(summaryId), {
      summaryText,
    });
  },

  async confirm(summaryId: string): Promise<NeedSummary> {
    return apiClient.post<NeedSummary>(endpoints.needSummaries.confirm(summaryId));
  },

  /** Bulk confirm from the reviewer queue. Returns which ids did not take, so
   *  the UI can report a partial result rather than claiming all succeeded. */
  async confirmMany(summaryIds: string[]): Promise<ConfirmBatchResult> {
    return apiClient.post<ConfirmBatchResult>(endpoints.needSummaries.confirmBatch, {
      summaryIds,
    });
  },
};
