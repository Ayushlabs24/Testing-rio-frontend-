import { organizations } from "@/mocks/data/organizations";
import { roles } from "@/mocks/data/roles";
import { users } from "@/mocks/data/users";
import {
  findUserByEmail,
  findUserById,
  resolveContext,
  type AuthedContext,
} from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId, generateMockToken, mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RequestOtpPayload,
  ResetPasswordPayload,
  SessionContext,
  SignupPayload,
  VerifyOtpPayload,
} from "@/services/auth/auth.types";

/** The mock OTP is always this value — logged to the console for demo convenience. */
const MOCK_OTP_CODE = "123456";

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
      permissions: context.role.permissions,
    },
  };
}

/**
 * Mock implementation — every method has the exact call signature a real
 * backend-backed version would have. Swapping in a real API later means
 * rewriting the inside of these methods to call `apiClient` instead;
 * nothing outside this file changes.
 */
export const authService = {
  async login({ email, password }: LoginPayload): Promise<SessionContext> {
    await mockDelay();
    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      throw new ApiError({ message: "Invalid email or password.", status: 401 });
    }
    const token = generateMockToken();
    mockSession.save({ token, userId: user.id });
    return toSessionContext(resolveContext(user), token);
  },

  async signup({
    organizationName,
    name,
    email,
    password,
    consent,
  }: SignupPayload): Promise<SessionContext> {
    await mockDelay();
    if (findUserByEmail(email)) {
      throw new ApiError({
        message: "An account with this email already exists.",
        status: 409,
      });
    }
    if (!consent) {
      throw new ApiError({
        message: "You must accept the data-sharing consent to continue.",
        status: 400,
      });
    }

    const organization = {
      id: generateId("org"),
      name: organizationName,
      logoUrl: null,
      region: "",
      email: "",
      sector: null,
      villages: [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    organizations.push(organization);

    const orgAdminRole = roles.find((role) => role.key === "org_admin")!;
    const user = {
      id: generateId("user"),
      organizationId: organization.id,
      roleId: orgAdminRole.id,
      name,
      email,
      password,
      status: "active" as const,
      // Self-signup is itself the consent action (gated by the checkbox).
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    users.push(user);

    const token = generateMockToken();
    mockSession.save({ token, userId: user.id });
    return toSessionContext(resolveContext(user), token);
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
    const token = generateMockToken();
    mockSession.save({ token, userId: user.id });
    return toSessionContext(resolveContext(user), token);
  },

  async me(): Promise<SessionContext> {
    await mockDelay(150);
    const session = mockSession.read();
    const user = session ? findUserById(session.userId) : undefined;
    if (!session || !user) {
      throw new ApiError({ message: "Not authenticated.", status: 401 });
    }
    return toSessionContext(resolveContext(user), session.token);
  },

  async logout(): Promise<void> {
    await mockDelay(150);
    mockSession.clear();
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
