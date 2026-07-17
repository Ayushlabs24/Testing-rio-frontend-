import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  ContactPayload,
  ContactSubmissionResult,
  OrganizationOption,
} from "@/services/contact/contact.types";

/**
 * The public enquiry form on the auth pages. Both routes are unauthenticated on
 * the backend (see contact.controller.ts) — they are reached by people who
 * cannot sign in, so there is no session to send.
 */
export const contactService = {
  /** Populates the form's org picker. */
  async listOrganizations(): Promise<OrganizationOption[]> {
    return apiClient.get<OrganizationOption[]>(endpoints.contact.organizations);
  },

  /**
   * Resolves only once the enquiry has actually been emailed. The backend
   * returns 503 rather than a success body when it has no deliverable
   * recipient or the mail transport fails, so a resolved promise here means
   * delivered — the form can safely show its confirmation.
   */
  async submit(payload: ContactPayload): Promise<ContactSubmissionResult> {
    return apiClient.post<ContactSubmissionResult>(endpoints.contact.submit, payload);
  },
};
