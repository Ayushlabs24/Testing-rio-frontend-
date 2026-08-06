import { findUserByEmail, resolveContext, type AuthedContext } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateMockToken, mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import type {
  RequestOtpPayload,
  SessionContext,
  VerifyOtpPayload,
} from "@/services/auth/auth.types";

/**
 * Mock staff-OTP sign-in — isolated in its own module, never imported by
 * `auth.service.ts` at the top level, only dynamically imported behind the
 * explicit `NEXT_PUBLIC_ENABLE_MOCK_AUTH` gate (see auth.service.ts). This
 * keeps the whole module (including the fixed code below) out of a
 * production bundle built without that flag set — a static top-level
 * import would ship it unconditionally regardless of any runtime `if`.
 *
 * The staff "Sign in with OTP" flow has no real backend endpoint yet (see
 * auth.service.ts's own doc comment) — this exists purely so local/test
 * runs can still exercise the UI flow end to end while that's true.
 */
const MOCK_OTP_CODE = "123456";

/** Used only by tests that explicitly enable mock auth — never exported
 * from `auth.service.ts` or referenced by any production code path. */
export function mockOtpCodeForTests(): string {
  return MOCK_OTP_CODE;
}

/** Used by the still-mock methods below — resolves a mock user's full context. */
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
      // Same for RIO-DATA-001's data-sharing consent.
      sharingConsentedAt: null,
      sharingConsentedPolicyVersion: null,
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
    // Mock accounts already "know" their password — there's no signup-issued
    // temp password in this path to force a change on.
    mustChangePassword: false,
  };
}

export async function mockRequestOtp({
  email,
}: RequestOtpPayload): Promise<{ message: string }> {
  await mockDelay();
  if (!findUserByEmail(email)) {
    throw new ApiError({ message: "No account found for this email.", status: 404 });
  }
  // Deliberately not logged — a real OTP is never written to the console
  // even in the mock path. Retrieve it via mockOtpCodeForTests() instead.
  return { message: "Code sent." };
}

export async function mockVerifyOtp({
  email,
  code,
}: VerifyOtpPayload): Promise<SessionContext> {
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
}
