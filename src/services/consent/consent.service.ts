import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  ActiveConsentPolicy,
  OrganizationConsentStatus,
} from "@/services/consent/consent.types";

export const consentService = {
  // Open route on the backend (no session required) — the signup screen
  // needs the policy text/version before the caller has any account yet.
  async getActive(): Promise<ActiveConsentPolicy> {
    return apiClient.get<ActiveConsentPolicy>(endpoints.consentPolicy.active);
  },

  // Authenticated — read-only Consent card on Organization Settings.
  async getOrganizationStatus(): Promise<OrganizationConsentStatus> {
    return apiClient.get<OrganizationConsentStatus>(
      endpoints.consentPolicy.organizationStatus,
    );
  },
};
