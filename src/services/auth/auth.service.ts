import { roles } from "@/mocks/data/roles";
import { findUserByEmail, resolveContext, type AuthedContext } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateMockToken, mockDelay } from "@/mocks/utils";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
import type { ModulePermission } from "@/types/permissions";
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

/** The mock OTP is always this value — logged to the console for demo convenience. */
const MOCK_OTP_CODE = "123456";

/** Shape returned by the real backend's /auth/login, /auth/me, /auth/change-password. */
interface ApiSessionView {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    consentedAt: string | null;
    consentedPolicyVersion: string | null;
  };
  organization: {
    id: string;
    name: string;
    purpose: string;
    registrationNumber: string;
    logoUrl: string | null;
    region: string[];
    email: string | null;
    sector: string | null;
    villages: string[];
    regionId: string | null;
    governorateIds: string[];
    centerIds: string[];
    isActive: boolean;
    createdAt: string;
  };
  // The backend's actual authorization data — crossEntity and permissions
  // are both real, enforced-server-side fields, not display copy. `name`
  // is deliberately NOT read from here (see toSessionContextFromApi): the
  // frontend's local roles.ts carries this session's product-copy renames
  // the backend doesn't track, same as rolesService.list()'s "display source
  // only" split. `enabled` doesn't exist server-side at all — it's a
  // UI-only "is this role live for the current demo phase" gate.
  role: { key: string; crossEntity: boolean; permissions: ModulePermission[] };
  mustChangePassword: boolean;
}

/** /auth/signup's response — the same session shape plus how the temporary password was delivered. */
interface ApiSignupView extends ApiSessionView {
  temporaryPasswordEmailed: boolean;
  temporaryPassword?: string;
}

/** Used by the still-mock methods (verifyOtp, giveConsent) — resolves a mock user's full context. */
function toSessionContext(context: AuthedContext, token: string): SessionContext {
  return {
    token,
    user: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
      consentedAt: context.user.consentedAt,
      // Mock accounts don't model policy versioning — null is equivalent to
      // "not yet consented under a version", same as a fresh real signup.
      consentedPolicyVersion: null,
    },
    organization: {
      id: context.organization.id,
      name: context.organization.name,
      purpose: context.organization.purpose,
      registrationNumber: context.organization.registrationNumber,
      logoUrl: context.organization.logoUrl,
      region: context.organization.region,
      email: context.organization.email,
      sector: context.organization.sector,
      villages: context.organization.villages,
      // Mock accounts don't model the KSA geography link.
      regionId: null,
      governorateIds: [],
      centerIds: [],
      isActive: context.organization.isActive,
      createdAt: context.organization.createdAt,
    },
    role: {
      id: context.role.id,
      key: context.role.key,
      name: context.role.name,
      crossEntity: context.role.crossEntity,
      enabled: context.role.enabled,
      permissions: context.role.permissions,
    },
    // Mock accounts (verifyOtp, giveConsent) already "know" their password —
    // there's no signup-issued temp password in this path to force a change on.
    mustChangePassword: false,
  };
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
    },
    organization: {
      id: view.organization.id,
      name: view.organization.name,
      purpose: view.organization.purpose,
      registrationNumber: view.organization.registrationNumber,
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
 * `requestOtp`/`verifyOtp` (staff sign-in OTP, distinct from citizen survey
 * OTP) have no backend counterpart yet and stay on the mock layer until one
 * exists — each gets swapped independently as its own endpoint lands, per
 * the project's incremental-swap convention.
 */
export const authService = {
  async login(payload: LoginPayload): Promise<SessionContext> {
    const view = await apiClient.post<ApiSessionView>(endpoints.auth.login, payload);
    return toSessionContextFromApi(view);
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
    const view = await apiClient.post<ApiSignupView>(endpoints.auth.signup, payload);
    return {
      session: toSessionContextFromApi(view),
      temporaryPasswordEmailed: view.temporaryPasswordEmailed,
      temporaryPassword: view.temporaryPassword,
    };
  },

  async me(): Promise<SessionContext> {
    const view = await apiClient.get<ApiSessionView>(endpoints.auth.me);
    return toSessionContextFromApi(view);
  },

  /**
   * Sets the signed-in user's own password — the one path off a
   * signup-issued temp password (`mustChangePassword: true`) onto one they
   * chose. The backend verifies `currentPassword` against the existing
   * hash before accepting `newPassword`, same as any password change.
   */
  async changePassword(payload: ChangePasswordPayload): Promise<SessionContext> {
    const view = await apiClient.post<ApiSessionView>(
      endpoints.auth.changePassword,
      payload,
    );
    return toSessionContextFromApi(view);
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

  async requestOtp({ email }: RequestOtpPayload): Promise<{ message: string }> {
    await mockDelay();
    if (!findUserByEmail(email)) {
      throw new ApiError({ message: "No account found for this email.", status: 404 });
    }
    console.info(`[mock] OTP for ${email}: ${MOCK_OTP_CODE}`);
    return { message: "Code sent." };
  },

  async verifyOtp({ email, code }: VerifyOtpPayload): Promise<SessionContext> {
    await mockDelay();
    const user = findUserByEmail(email);
    if (!user || code !== MOCK_OTP_CODE) {
      throw new ApiError({ message: "Invalid or expired code.", status: 401 });
    }
    const context = resolveContext(user);
    // A disabled role (see roles.ts) can still authenticate — `enabled`
    // gates the UI, never the session itself. See usePermission/app-sidebar.
    const token = generateMockToken();
    mockSession.save({ token, userId: user.id });
    return toSessionContext(context, token);
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
