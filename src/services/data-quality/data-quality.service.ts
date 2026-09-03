import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CleaningFlag,
  DataQualitySummary,
  DuplicateCandidate,
  DuplicatePage,
  FlagPage,
  ListDuplicatesParams,
  ListFlagsParams,
  MergeHistoryPage,
  MergePreview,
  MergeResult,
} from "@/services/data-quality/data-quality.types";

export const dataQualityService = {
  async listFlags(params: ListFlagsParams, signal?: AbortSignal): Promise<FlagPage> {
    // Spread into a plain record: QueryParams is an index-signature type and
    // ListFlagsParams is a closed interface, which TypeScript will not widen.
    return apiClient.get<FlagPage>(endpoints.dataQuality.flags, {
      params: { ...params },
      signal,
    });
  },
  async summary(signal?: AbortSignal): Promise<DataQualitySummary> {
    return apiClient.get<DataQualitySummary>(endpoints.dataQuality.summary, { signal });
  },
  async review(
    flagId: string,
    decision: "accept" | "reject",
    note?: string,
  ): Promise<CleaningFlag> {
    return apiClient.post<CleaningFlag>(endpoints.dataQuality.review(flagId), {
      decision,
      ...(note ? { note } : {}),
    });
  },
  async listDuplicates(
    params: ListDuplicatesParams,
    signal?: AbortSignal,
  ): Promise<DuplicatePage> {
    return apiClient.get<DuplicatePage>(endpoints.dataQuality.duplicates, {
      params: { ...params },
      signal,
    });
  },
  async decideDuplicate(
    candidateId: string,
    decision: "confirmed_duplicate" | "not_duplicate",
    note?: string,
  ): Promise<DuplicateCandidate> {
    return apiClient.post<DuplicateCandidate>(
      endpoints.dataQuality.decideDuplicate(candidateId),
      { decision, ...(note ? { note } : {}) },
    );
  },
  // ─── RIO-AI-004: merge ───────────────────────────────────────────────────

  /**
   * What a merge would do, without doing it. Read-only, so a reviewer without
   * approve rights can still see what the queue is proposing.
   */
  async previewMerge(
    survivorNeedId: string,
    retiredNeedId: string,
    signal?: AbortSignal,
  ): Promise<MergePreview> {
    return apiClient.get<MergePreview>(endpoints.dataQuality.mergePreview, {
      params: { survivorNeedId, retiredNeedId },
      signal,
    });
  },
  async merge(input: {
    survivorNeedId: string;
    retiredNeedId: string;
    candidateId?: string;
    note?: string;
  }): Promise<MergeResult> {
    return apiClient.post<MergeResult>(endpoints.dataQuality.merges, input);
  },
  async listMerges(
    params: { page?: number; pageSize?: number },
    signal?: AbortSignal,
  ): Promise<MergeHistoryPage> {
    return apiClient.get<MergeHistoryPage>(endpoints.dataQuality.merges, {
      params: { ...params },
      signal,
    });
  },
  async undoMerge(mergeId: string, note: string): Promise<{ restored: number }> {
    return apiClient.post<{ restored: number }>(
      endpoints.dataQuality.undoMerge(mergeId),
      {
        note,
      },
    );
  },

  async bulkAccept(
    ruleCode: string,
    note?: string,
  ): Promise<{ accepted: number; skipped: number }> {
    return apiClient.post<{ accepted: number; skipped: number }>(
      endpoints.dataQuality.bulkAccept,
      { ruleCode, ...(note ? { note } : {}) },
    );
  },
};
