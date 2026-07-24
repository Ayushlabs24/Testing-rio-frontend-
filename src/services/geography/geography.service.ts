import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { Center, Governorate, Region } from "@/services/geography/geography.types";

export const geographyService = {
  async listRegions(): Promise<Region[]> {
    return apiClient.get<Region[]>(endpoints.geography.regions);
  },

  async listGovernorates(regionId?: string): Promise<Governorate[]> {
    return apiClient.get<Governorate[]>(endpoints.geography.governorates, {
      params: { regionId },
    });
  },

  async listCenters(governorateId?: string): Promise<Center[]> {
    return apiClient.get<Center[]>(endpoints.geography.centers, {
      params: { governorateId },
    });
  },
};
