import { studies } from "@/mocks/data/studies";
import { mockDelay } from "@/mocks/utils";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateStudyPayload,
  ListStudiesParams,
  PlatformStudyStats,
  Study,
  StudyDetail,
  StudySummary,
  UpdateStudyPayload,
} from "@/services/studies/studies.types";

/**
 * CRUD runs against the real backend (its studies module). `create`/`update`
 * only ever accept title/villages — domain/subDomain are set server-side
 * once a human approves an AI Classification decision, never a direct PATCH.
 * Status only ever advances through the Need/Evidence/AI Classification/
 * Human Review workflow. `remove` is status-gated server-side (409
 * STUDY_NOT_DELETABLE once ai_classified/human_reviewed). `getPlatformStats`
 * is still mock-backed — there is no stats endpoint yet, so it stays on
 * `mocks/data/studies` until one exists, per the incremental-swap convention.
 */
export const studiesService = {
  async list(params: ListStudiesParams = {}): Promise<StudySummary[]> {
    // The backend wraps this as { items, total, limit, offset } — unwrapped
    // here so callers still just get an array.
    const { items } = await apiClient.get<{ items: StudySummary[] }>(
      endpoints.studies.list,
      {
        // buildUrl drops undefined entries, so an unset filter never reaches
        // the query string.
        params: {
          limit: params.limit,
          offset: params.offset,
          search: params.search,
        },
      },
    );
    return items;
  },

  async getById(id: string): Promise<StudyDetail> {
    return apiClient.get<StudyDetail>(endpoints.studies.byId(id));
  },

  async create(payload: CreateStudyPayload): Promise<Study> {
    return apiClient.post<Study>(endpoints.studies.create, payload);
  },

  async update(id: string, payload: UpdateStudyPayload): Promise<Study> {
    return apiClient.patch<Study>(endpoints.studies.byId(id), payload);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<void>(endpoints.studies.byId(id));
  },

  /** Cross-entity — every organization's studies, not just the caller's own. */
  async getPlatformStats(): Promise<PlatformStudyStats> {
    await mockDelay();
    return {
      activeStudies: studies.filter((study) => study.status === "active").length,
      pendingReviews: studies.filter((study) => study.reviewStatus === "pending").length,
      reportsGenerated: studies.filter((study) => study.reportGenerated).length,
    };
  },
};
