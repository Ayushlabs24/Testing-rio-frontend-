import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { SharingAlert } from "@/services/sharing-alerts/sharing-alerts.types";

export const sharingAlertsService = {
  async listAlerts(): Promise<SharingAlert[]> {
    return apiClient.get<SharingAlert[]>(endpoints.sharingAlerts.list);
  },
};
