import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { ArchiveEntry, ListArchiveParams } from "@/services/archive/archive.types";

export const archiveService = {
  async list(params: ListArchiveParams = {}): Promise<ArchiveEntry[]> {
    return apiClient.get<ArchiveEntry[]>(endpoints.archive.list, {
      params: {
        kind: params.kind,
        search: params.search,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        organizationId: params.organizationId,
        region: params.region,
        sector: params.sector,
        village: params.village,
      },
    });
  },
};
