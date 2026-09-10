import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  GeoMapParams,
  GeoMapResponse,
} from "@/services/geographic-dashboard/geographic-dashboard.types";

export const geographicDashboardService = {
  // RIO-FR-008 — needs aggregated onto map points at the requested level.
  async getMap(params: GeoMapParams = {}): Promise<GeoMapResponse> {
    return apiClient.get<GeoMapResponse>(endpoints.geographicDashboard.map, {
      params: {
        level: params.level,
        sector: params.sector,
        urgency: params.urgency,
        status: params.status,
      },
    });
  },
};
