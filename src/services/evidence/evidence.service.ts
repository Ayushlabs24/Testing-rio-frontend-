import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { Evidence } from "@/services/evidence/evidence.types";

export const evidenceService = {
  async listByNeed(needId: string): Promise<Evidence[]> {
    return apiClient.get<Evidence[]>(endpoints.evidence.forNeed(needId));
  },

  /**
   * One file per request — the backend's endpoint accepts multiple, but
   * uploading one at a time here gives each queued file its own
   * progress/retry lifecycle in the UI instead of an all-or-nothing batch.
   */
  async upload(
    needId: string,
    file: File,
    options?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
  ): Promise<Evidence> {
    const formData = new FormData();
    formData.append("files", file);
    const created = await apiClient.uploadForm<Evidence[]>(
      endpoints.evidence.forNeed(needId),
      formData,
      options,
    );
    return created[0];
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(endpoints.evidence.byId(id));
  },

  // A distinct step from uploading — AI Classification only
  // becomes eligible once evidence has been explicitly submitted.
  async submit(needId: string): Promise<void> {
    await apiClient.post(endpoints.evidence.submit(needId));
  },
};
