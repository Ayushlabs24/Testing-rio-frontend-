import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateHistoricalStudyPayload,
  HistoricalStudy,
} from "@/services/historical-studies/historical-studies.types";

export const historicalStudiesService = {
  async list(): Promise<HistoricalStudy[]> {
    return apiClient.get<HistoricalStudy[]>(endpoints.historicalStudies.list);
  },

  async create(payload: CreateHistoricalStudyPayload): Promise<HistoricalStudy> {
    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("region", JSON.stringify(payload.region));
    formData.append("governorateIds", JSON.stringify(payload.governorateIds));
    formData.append("centerIds", JSON.stringify(payload.centerIds));
    if (payload.targetSector) formData.append("targetSector", payload.targetSector);
    formData.append("studyDate", payload.studyDate);
    formData.append("author", payload.author);
    formData.append("methodologyVersionLabel", payload.methodologyVersionLabel);
    formData.append("file", payload.file);
    return apiClient.uploadForm<HistoricalStudy>(
      endpoints.historicalStudies.create,
      formData,
    );
  },

  async getFileBlob(id: string): Promise<Blob> {
    return apiClient.downloadBlob(endpoints.historicalStudies.file(id));
  },
};
