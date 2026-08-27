import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CheckDuplicatePayload,
  RecordSessionEventPayload,
  StartSessionResult,
  CheckDuplicateResult,
  RequestOtpPayload,
  RequestOtpResult,
  ResolvedSurvey,
  SubmitResponsePayload,
  SubmitResponseResult,
  VerifyOtpPayload,
} from "@/services/citizen/citizen.types";

/**
 * Every method here calls a fully unauthenticated backend route (see the
 * backend's CitizenController) — no session/token is ever attached, the
 * survey link token is the only identifier.
 */
export const citizenService = {
  async resolveSurvey(token: string): Promise<ResolvedSurvey> {
    return apiClient.get<ResolvedSurvey>(endpoints.citizen.resolve(token));
  },

  /**
   * Abandonment tracking (RPT10 Q-2). Both calls are fire-and-forget from the
   * caller's point of view — a respondent must never see an error, or be
   * blocked, because telemetry about their sitting failed to post. Failures
   * resolve to null/false rather than throwing.
   */
  async startSession(token: string): Promise<StartSessionResult | null> {
    try {
      return await apiClient.post<StartSessionResult | null>(
        endpoints.citizen.startSession(token),
        {},
      );
    } catch {
      return null;
    }
  },

  async recordSessionEvent(
    token: string,
    sessionId: string,
    payload: RecordSessionEventPayload,
  ): Promise<boolean> {
    try {
      await apiClient.post(endpoints.citizen.sessionEvent(token, sessionId), payload);
      return true;
    } catch {
      return false;
    }
  },

  async checkDuplicate(
    token: string,
    payload: CheckDuplicatePayload,
  ): Promise<CheckDuplicateResult> {
    return apiClient.post<CheckDuplicateResult>(
      endpoints.citizen.checkDuplicate(token),
      payload,
    );
  },

  async requestOtp(token: string, payload: RequestOtpPayload): Promise<RequestOtpResult> {
    return apiClient.post<RequestOtpResult>(endpoints.citizen.requestOtp(token), payload);
  },

  async verifyOtp(token: string, payload: VerifyOtpPayload): Promise<{ verified: true }> {
    return apiClient.post<{ verified: true }>(
      endpoints.citizen.verifyOtp(token),
      payload,
    );
  },

  async submitResponse(
    token: string,
    payload: SubmitResponsePayload,
  ): Promise<SubmitResponseResult> {
    return apiClient.post<SubmitResponseResult>(
      endpoints.citizen.submitResponse(token),
      payload,
    );
  },
};
