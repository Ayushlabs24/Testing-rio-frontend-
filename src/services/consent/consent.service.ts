import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { ActiveConsentPolicy } from "@/services/consent/consent.types";

// Open route on the backend (no session required) — the signup screen
// needs the policy text/version before the caller has any account yet.
export const consentService = {
  async getActive(): Promise<ActiveConsentPolicy> {
    return apiClient.get<ActiveConsentPolicy>(endpoints.consentPolicy.active);
  },
};
