import { roles } from "@/mocks/data/roles";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import {
  apiSessionViewSchema,
  apiSignupViewSchema,
  type ApiSessionView,
  type ApiSignupView,
} from "@/services/auth/auth.schemas";
import type {
  ChangePasswordPayload,
  ForgotPasswordPayload,
  LoginPayload,
  RequestOtpPayload,
  ResetPasswordPayload,
  SessionContext,
  SignupPayload,
  SignupResult,
  VerifyOtpPayload,
} from "@/services/auth/auth.types";

/**
 * Validates an untrusted session/signup response at runtime before any of
 * it is used — `permissions`/`crossEntity` in particular drive every
 * `usePermission` check and `PermissionGuard` in the app, so a malformed or
 * unexpectedly-shaped response here needs to fail loudly (a typed
 * `ApiError`, same shape every other transport failure surfaces as) rather
 * than silently propagate `undefined`s into the permission system.
 */
function parseSessionView(raw: unknown): ApiSessionView {
  const result = apiSessionViewSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError({
      message: "The server returned an unexpected session response shape.",
      status: 502,
      details: result.error.issues,
    });
  }
  return result.data;
}

function parseSignupView(raw: unknown): ApiSignupView {
  const result = apiSignupViewSchema.safeParse(raw);
  if (!result.success) {
    throw new ApiError({
      message: "The server returned an unexpected signup response shape.",
      status: 502,
      details: result.error.issues,
    });
  }
  return result.data;
}

/**
 * Builds a full `SessionContext` from the real backend's session response.
 * `permissions`/`crossEntity` come straight from the backend's own role
 * matrix now — this used to resolve permissions from the local `roles.ts`
 * mock instead (a stale leftover from before the backend carried them),
 * which meant a real permission grant could silently diverge from what the
 * UI actually enforced. `roles.ts` is now only consulted for `name` (this
 * session's product-copy renames the backend doesn't track) and `enabled`
 * (a UI-only "is this role live for the current demo phase" gate that
 * doesn't exist server-side at all) — same "display source only" split
 * documented in rolesService.list().
 */
function toSessionContextFromApi(view: ApiSessionView): SessionContext {
  const role = roles.find((r) => r.key === view.role.key);
  if (!role) {
    throw new ApiError({
      message: `Unknown role "${view.role.key}" returned by the server.`,
      status: 500,
    });
  }
  return {
    token: view.token,
    user: {
      id: view.user.id,
      name: view.user.name,
      email: view.user.email,
      consentedAt: view.user.consentedAt,
      consentedPolicyVersion: view.user.consentedPolicyVersion,
      sharingConsentedAt: view.user.sharingConsentedAt,
      sharingConsentedPolicyVersion: view.user.sharingConsentedPolicyVersion,
    },
    organization: {
      id: view.organization.id,
      name: view.organization.name,
      purpose: view.organization.purpose ?? "",
      registrationNumber: view.organization.registrationNumber ?? "",
      logoUrl: view.organization.logoUrl,
      region: view.organization.region,
      email: view.organization.email ?? "",
      sector: view.organization.sector,
      villages: view.organization.villages,
      regionId: view.organization.regionId,
      governorateIds: view.organization.governorateIds,
      centerIds: view.organization.centerIds,
      isActive: view.organization.isActive,
      createdAt: view.organization.createdAt,
    },
    role: {
      id: role.id,
      key: view.role.key,
      name: role.name,
      crossEntity: view.role.crossEntity,
      enabled: role.enabled,
      permissions: view.role.permissions,
    },
    mustChangePassword: view.mustChangePassword,
  };
}

/**
 * `login`/`signup`/`me`/`logout`/`changePassword`/`giveConsent`/
 * `forgotPassword`/`resetPassword` call the real backend — the session
 * lives in an httpOnly cookie the server sets/reads (see
 * Project-RIO-Backend's auth.controller.ts), not in `mockSession`.
 *
 * `requestOtp`/`verifyOtp` (staff sign-in OTP, distinct from citizen survey
 * OTP) have no backend counterpart yet. They call the real backend endpoint
 * by default — which will simply fail until that endpoint exists, rather
 * than silently succeeding against a fixed code — and only fall back to the
 * isolated mock in `./otp.mock` when `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true` is
 * explicitly set (never the default, never set in a real deployment). See
 * env.ts and otp.mock.ts for why this is a raw `process.env` read rather
 * than going through the parsed `env` object: Next.js statically replaces
 * `process.env.NEXT_PUBLIC_*` at build time, which lets the bundler
 * eliminate the entire dynamically-imported mock module (fixed code
 * included) from a build where the flag is unset.
 */
export const authService = {
  async login(payload: LoginPayload): Promise<SessionContext> {
    const raw = await apiClient.post<unknown>(endpoints.auth.login, payload);
    return toSessionContextFromApi(parseSessionView(raw));
  },

  /**
   * Public signup: creates a new organization and its first NGO Admin
   * together — the email itself *is* the NGO Admin account, and the
   * backend issues a temporary password rather than taking one from the
   * form. The backend emails it when its mailer is configured
   * (`temporaryPasswordEmailed: true`); otherwise `temporaryPassword` is
   * returned here as a one-time in-app fallback. The registration-number
   * check runs first and is the uniqueness key — the org name is *not*
   * checked, per the team lead's spec, so two orgs could in principle share
   * a name but never a registration number.
   */
  async signup(payload: SignupPayload): Promise<SignupResult> {
    const raw = await apiClient.post<unknown>(endpoints.auth.signup, payload);
    const view = parseSignupView(raw);
    return {
      session: toSessionContextFromApi(view),
      temporaryPasswordEmailed: view.temporaryPasswordEmailed,
      temporaryPassword: view.temporaryPassword,
    };
  },

  async me(): Promise<SessionContext> {
    const raw = await apiClient.get<unknown>(endpoints.auth.me);
    return toSessionContextFromApi(parseSessionView(raw));
  },

  /**
   * Sets the signed-in user's own password — the one path off a
   * signup-issued temp password (`mustChangePassword: true`) onto one they
   * chose. The backend verifies `currentPassword` against the existing
   * hash before accepting `newPassword`, same as any password change.
   */
  async changePassword(payload: ChangePasswordPayload): Promise<SessionContext> {
    const raw = await apiClient.post<unknown>(endpoints.auth.changePassword, payload);
    return toSessionContextFromApi(parseSessionView(raw));
  },

  async logout(): Promise<void> {
    await apiClient.post(endpoints.auth.logout);
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(endpoints.auth.forgotPassword, payload);
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(endpoints.auth.resetPassword, payload);
  },

  async requestOtp(payload: RequestOtpPayload): Promise<{ message: string }> {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true") {
      const { mockRequestOtp } = await import("@/services/auth/otp.mock");
      return mockRequestOtp(payload);
    }
    return apiClient.post<{ message: string }>(endpoints.auth.requestOtp, payload);
  },

  async verifyOtp(payload: VerifyOtpPayload): Promise<SessionContext> {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true") {
      const { mockVerifyOtp } = await import("@/services/auth/otp.mock");
      return mockVerifyOtp(payload);
    }
    const raw = await apiClient.post<unknown>(endpoints.auth.verifyOtp, payload);
    return toSessionContextFromApi(parseSessionView(raw));
  },

  /**
   * Records consent for the current session's user (e.g. an admin-invited
   * user's first login). The backend's response is just `{ consentedAt,
   * policyVersion }` (see AuthService.consent()), not a full session — so
   * this re-fetches `me()` afterward rather than trying to hand-merge a
   * partial response into the existing session.
   */
  async giveConsent(): Promise<SessionContext> {
    await apiClient.post(endpoints.auth.consent);
    return authService.me();
  },
};
