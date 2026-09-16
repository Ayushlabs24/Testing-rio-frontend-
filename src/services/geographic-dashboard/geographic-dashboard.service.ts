import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  GeoMapParams,
  GeoMapResponse,
  GeoPointItemsParams,
  GeoPointItemsResponse,
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

  /**
   * The rows behind one point's figures.
   *
   * The active filters are passed straight through. The panel is showing a
   * point from a filtered view, so a list that ignored them would not match
   * the count the reader just clicked.
   */
  async getPointItems(
    pointId: string,
    params: GeoPointItemsParams = {},
  ): Promise<GeoPointItemsResponse> {
    return apiClient.get<GeoPointItemsResponse>(
      endpoints.geographicDashboard.pointItems(pointId),
      {
        params: {
          level: params.level,
          kind: params.kind,
          sector: params.sector,
          urgency: params.urgency,
          status: params.status,
        },
      },
    );
  },
};
