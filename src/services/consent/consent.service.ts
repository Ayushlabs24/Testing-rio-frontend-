import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  ActiveConsentPolicies,
  OrganizationConsentStatus,
} from "@/services/consent/consent.types";

export const consentService = {
  // Open route on the backend (no session required) — the registration
  // screen needs BOTH policies' text/version before the caller has any
  // account yet, since RIO-DATA-001 requires consent during registration.
  async getActive(): Promise<ActiveConsentPolicies> {
    return apiClient.get<ActiveConsentPolicies>(endpoints.consentPolicy.active);
  },

  // Authenticated — read-only Consent card on Organization Settings.
  async getOrganizationStatus(): Promise<OrganizationConsentStatus> {
    return apiClient.get<OrganizationConsentStatus>(
      endpoints.consentPolicy.organizationStatus,
    );
  },
};
