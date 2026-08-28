import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  ActiveConsentPolicies,
  ActiveConsentPolicy,
  ConsentPolicyVersion,
  ConsentPolicyVersionList,
  CreateConsentPolicyPayload,
  OrganizationConsentStatus,
  UpdateConsentPolicyPayload,
} from "@/services/consent/consent.types";

export const consentService = {
  // Open route on the backend (no session required) — the registration
  // screen needs BOTH policies' text/version before the caller has any
  // account yet, since RIO-DATA-001 requires consent during registration.
  async getActive(): Promise<ActiveConsentPolicies> {
    return apiClient.get<ActiveConsentPolicies>(endpoints.consentPolicy.active);
  },

  // Open route, like getActive above: the citizen survey screen is entirely
  // unauthenticated, and the notice has to be readable before any personal
  // detail is collected.
  async getActiveCitizenPolicy(): Promise<ActiveConsentPolicy> {
    return apiClient.get<ActiveConsentPolicy>(endpoints.consentPolicy.citizen);
  },

  // Authenticated — read-only Consent card on Organization Settings.
  async getOrganizationStatus(): Promise<OrganizationConsentStatus> {
    return apiClient.get<OrganizationConsentStatus>(
      endpoints.consentPolicy.organizationStatus,
    );
  },

  // ───────────── Consent Policies tab (Methodology Configuration)
  //
  // Client-confirmed (2026-08-27): policy text is drafted and versioned in
  // the app rather than hardcoded. Which of these a given user may call is
  // decided by the backend's @RequirePermission — System Admin holds
  // onboardingConsent write/create (draft, edit, submit, publish), System
  // Reviewer holds approve (approve, reject). The tab hides what the caller
  // can't do; the server is what enforces it.

  /** Every version of both policies, newest first — drafts included. */
  async listVersions(): Promise<ConsentPolicyVersionList> {
    return apiClient.get<ConsentPolicyVersionList>(endpoints.consentPolicy.versions);
  },

  async createVersion(
    payload: CreateConsentPolicyPayload,
  ): Promise<ConsentPolicyVersion> {
    return apiClient.post<ConsentPolicyVersion>(
      endpoints.consentPolicy.versions,
      payload,
    );
  },

  async updateVersion(
    id: string,
    payload: UpdateConsentPolicyPayload,
  ): Promise<ConsentPolicyVersion> {
    return apiClient.patch<ConsentPolicyVersion>(
      endpoints.consentPolicy.version(id),
      payload,
    );
  },

  async submitVersion(id: string): Promise<ConsentPolicyVersion> {
    return apiClient.post<ConsentPolicyVersion>(
      endpoints.consentPolicy.submitVersion(id),
    );
  },

  async approveVersion(id: string, notes: string): Promise<ConsentPolicyVersion> {
    return apiClient.patch<ConsentPolicyVersion>(
      endpoints.consentPolicy.approveVersion(id),
      { notes },
    );
  },

  async rejectVersion(id: string, notes: string): Promise<ConsentPolicyVersion> {
    return apiClient.patch<ConsentPolicyVersion>(
      endpoints.consentPolicy.rejectVersion(id),
      { notes },
    );
  },

  async publishVersion(id: string): Promise<ConsentPolicyVersion> {
    return apiClient.post<ConsentPolicyVersion>(
      endpoints.consentPolicy.publishVersion(id),
    );
  },
};
