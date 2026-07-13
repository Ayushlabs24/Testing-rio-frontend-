import { roles } from "@/mocks/data/roles";
import {
  findUserByEmail,
  findUserById,
  resolveContext,
  type AuthedContext,
} from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateMockToken, mockDelay } from "@/mocks/utils";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { ApiError } from "@/services/api/types";
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
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string; purpose: string; registrationNumber: string };
  role: { key: string };
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
 * Builds a full `SessionContext` from the real backend's (currently minimal)
 * session response. The backend has no roles/permissions or full
 * organization-profile API yet — this resolves the role's permission
 * matrix from the same local `roles.ts` the rest of the still-mocked app
 * already treats as the source of truth for that, and fills the
 * organization/consent fields the backend doesn't return yet with honest
 * defaults (not a lookup into mock org/user data — there may be no matching
 * mock entry at all for a real account).
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
      // The backend doesn't track consent yet — the only account it can
      // currently create (self-signup, NGO Admin) is self-consenting.
      consentedAt: new Date().toISOString(),
    },
    organization: {
      id: view.organization.id,
      name: view.organization.name,
      purpose: view.organization.purpose,
      registrationNumber: view.organization.registrationNumber,
      // Not yet returned by the backend (its Organisation model doesn't
      // carry these fields yet) — honest empty defaults, not a mock lookup.
      logoUrl: null,
      region: "",
      email: "",
      sector: null,
      villages: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    role: {
      id: role.id,
      key: role.key,
      name: role.name,
      crossEntity: role.crossEntity,
      enabled: role.enabled,
      permissions: role.permissions,
    },
    mustChangePassword: view.mustChangePassword,
  };
}

/**
 * `login`/`signup`/`me`/`logout` call the real backend — the session lives
 * in an httpOnly cookie the server sets/reads (see
 * Project-RIO-Backend's auth.controller.ts), not in `mockSession`.
 * `forgotPassword`/`requestOtp`/`verifyOtp`/`giveConsent` have no backend
 * counterpart yet and stay on the mock layer until one exists — each gets
 * swapped independently as its own endpoint lands, per the project's
 * incremental-swap convention.
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

  async forgotPassword(_payload: ForgotPasswordPayload): Promise<{ message: string }> {
    await mockDelay();
    // Always report success, regardless of whether the email exists — avoids
    // leaking which emails are registered, and mirrors real-world behavior.
    return { message: "If that email exists, a reset link has been sent." };
  },

  async resetPassword(_payload: ResetPasswordPayload): Promise<{ message: string }> {
    await mockDelay();
    return { message: "Password reset." };
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

  /** Records consent for the current session's user (e.g. an admin-invited user's first login). */
  async giveConsent(): Promise<SessionContext> {
    await mockDelay(200);
    const session = mockSession.read();
    const user = session ? findUserById(session.userId) : undefined;
    if (!session || !user) {
      throw new ApiError({ message: "Not authenticated.", status: 401 });
    }
    user.consentedAt = new Date().toISOString();
    return toSessionContext(resolveContext(user), session.token);
  },
};
