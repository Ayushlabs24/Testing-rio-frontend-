import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { Evidence } from "@/services/evidence/evidence.types";

export const evidenceService = {
  async listByStudy(studyId: string): Promise<Evidence[]> {
    return apiClient.get<Evidence[]>(endpoints.evidence.forStudy(studyId));
  },

  /**
   * One file per request — the backend's endpoint accepts multiple, but
   * uploading one at a time here gives each queued file its own
   * progress/retry lifecycle in the UI instead of an all-or-nothing batch.
   */
  async upload(
    studyId: string,
    file: File,
    options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
  ): Promise<Evidence> {
    const formData = new FormData();
    formData.append("files", file);
    const created = await apiClient.uploadForm<Evidence[]>(
      endpoints.evidence.forStudy(studyId),
      formData,
      options,
    );
    return created[0];
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(endpoints.evidence.byId(id));
  },
};
