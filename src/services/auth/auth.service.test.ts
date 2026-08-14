import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { authService } from "@/services/auth/auth.service";

/**
 * `authService.login/signup/me/logout` call the real backend now (see
 * auth.service.ts) — duplicate-registration-number/email checks and
 * password verification live server-side (covered in
 * Project-RIO-Backend's auth.service.spec.ts). These tests only cover the
 * frontend's own responsibility: calling the right endpoint with the right
 * payload, and correctly mapping the backend's session response into a
 * full `SessionContext` (permissions/crossEntity come from the backend's
 * own response now; only display-only `name`/`enabled` still resolve from
 * the local roles.ts matrix).
 */
vi.mock("@/services/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

const apiSession = {
  token: "jwt-token",
  user: {
    id: "user_1",
    name: "Priya Nair",
    email: "priya@demo.org",
    consentedAt: null,
    consentedPolicyVersion: null,
  },
  organization: {
    id: "org_1",
    name: "Demo NGO",
    purpose: "Community Health",
    registrationNumber: "REG-1",
    logoUrl: null,
    region: [],
    email: null,
    sector: null,
    villages: [],
    regionId: "region_1",
    governorateIds: [],
    centerIds: [],
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  role: {
    key: "ngo_admin",
    crossEntity: false,
    permissions: [
      {
        module: "studySurvey",
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      },
    ],
  },
  mustChangePassword: false,
};

describe("authService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("login() posts to /auth/login and maps the response into a full SessionContext", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(apiSession);

    const session = await authService.login({
      email: "priya@demo.org",
      password: "password123",
    });

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.login, {
      email: "priya@demo.org",
      password: "password123",
    });
    expect(session.token).toBe("jwt-token");
    expect(session.user.name).toBe("Priya Nair");
    expect(session.organization.registrationNumber).toBe("REG-1");
    // Permissions aren't in the API response — resolved from the local matrix.
    expect(session.role.key).toBe("ngo_admin");
    expect(session.role.crossEntity).toBe(false);
    expect(session.role.permissions.length).toBeGreaterThan(0);
  });

  // RIO-FR-010 (client-confirmed): signup no longer returns a session — it
  // requires Center (System Admin) approval before activation.
  it("signup() posts the full payload to /auth/signup and returns a pending_approval status, no session", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: "pending_approval",
      organizationName: "Demo NGO",
      email: "priya@demo.org",
    });

    const payload = {
      organizationName: "Demo NGO",
      sector: "healthcare",
      registrationNumber: "REG-1",
      email: "priya@demo.org",
      regionId: "r1",
      governorateIds: ["g1"],
      centerIds: ["c1"],
      // RIO-DATA-001 — both consents are part of the registration payload,
      // each pinned to the version AND the language it was displayed in.
      consent: {
        usePolicyVersion: "v1",
        dataSharingVersion: "v1",
        locale: "ar" as const,
      },
    };
    const result = await authService.signup(payload);

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.signup, payload);
    expect(result).toEqual({
      status: "pending_approval",
      organizationName: "Demo NGO",
      email: "priya@demo.org",
    });
  });

  it("me() reads the session via GET /auth/me", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      ...apiSession,
      role: { key: "human_reviewer", crossEntity: false, permissions: [] },
    });

    const session = await authService.me();

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.auth.me);
    expect(session.role.key).toBe("human_reviewer");
  });

  it("login() carries mustChangePassword through from the backend", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...apiSession,
      mustChangePassword: true,
    });

    const session = await authService.login({
      email: "priya@demo.org",
      password: "temp-password",
    });

    expect(session.mustChangePassword).toBe(true);
  });

  it("changePassword() posts to /auth/change-password and maps the returned session", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...apiSession,
      mustChangePassword: false,
    });

    const session = await authService.changePassword({
      currentPassword: "temp-password",
      newPassword: "brand-new-password",
    });

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.changePassword, {
      currentPassword: "temp-password",
      newPassword: "brand-new-password",
    });
    expect(session.mustChangePassword).toBe(false);
  });

  it("logout() posts to /auth/logout", async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined);

    await authService.logout();

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.logout);
  });

  it("giveConsent() posts to /auth/consent, then re-fetches me() for the updated session", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      consentedAt: "2026-01-02T00:00:00.000Z",
      policyVersion: "v1",
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      ...apiSession,
      user: {
        ...apiSession.user,
        consentedAt: "2026-01-02T00:00:00.000Z",
        consentedPolicyVersion: "v1",
      },
    });

    const session = await authService.giveConsent("ar");

    // The locale is what lets the server snapshot the wording the user read
    // rather than the English source.
    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.consent, { locale: "ar" });
    expect(apiClient.get).toHaveBeenCalledWith(endpoints.auth.me);
    expect(session.user.consentedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(session.user.consentedPolicyVersion).toBe("v1");
  });

  it("me() carries a null consentedAt through as-is (not yet consented)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(apiSession);

    const session = await authService.me();

    expect(session.user.consentedAt).toBeNull();
  });

  it("rejects with a 500 if the server returns a role key the frontend doesn't recognise", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...apiSession,
      // Structurally valid (passes runtime schema validation) but not a key
      // the frontend's local roles.ts matrix recognizes — the case this
      // test actually targets.
      role: { key: "not_a_real_role", crossEntity: false, permissions: [] },
    });

    await expect(
      authService.login({ email: "priya@demo.org", password: "password123" }),
    ).rejects.toMatchObject({ status: 500 });
  });

  describe("runtime response validation", () => {
    it("rejects a session response missing a required field with a typed ApiError", async () => {
      const { token: _omit, ...withoutToken } = apiSession;
      vi.mocked(apiClient.post).mockResolvedValue(withoutToken);

      await expect(
        authService.login({ email: "priya@demo.org", password: "password123" }),
      ).rejects.toMatchObject({ status: 502 });
    });

    it("rejects a session response with a field of the wrong primitive type", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        ...apiSession,
        // mustChangePassword must be boolean — a real backend regression
        // (e.g. returning "false" as a string) must not silently pass
        // through as truthy.
        mustChangePassword: "false",
      });

      await expect(
        authService.login({ email: "priya@demo.org", password: "password123" }),
      ).rejects.toMatchObject({ status: 502 });
    });

    it("rejects a permission entry with an invalid module enum value", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        ...apiSession,
        role: {
          ...apiSession.role,
          permissions: [
            {
              module: "notARealModule",
              read: true,
              write: true,
              create: true,
              approve: true,
              export: true,
              share: true,
            },
          ],
        },
      });

      await expect(
        authService.login({ email: "priya@demo.org", password: "password123" }),
      ).rejects.toMatchObject({ status: 502 });
    });

    it("accepts an otherwise-empty successful response shape for endpoints with no body contract", async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      await expect(authService.logout()).resolves.toBeUndefined();
    });

    // Regression: a real signup response had organization.purpose === null
    // (the backend's own SessionOrg type — session.types.ts — has always
    // declared purpose/registrationNumber as `string | null`; the frontend
    // schema incorrectly required non-null strings, so a real org that
    // hadn't picked "other" as its sector was rejected as "an unexpected
    // signup response shape" at signup time).
    it("accepts a null organization.purpose/registrationNumber and coalesces them to empty strings", async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        ...apiSession,
        organization: {
          ...apiSession.organization,
          purpose: null,
          registrationNumber: null,
        },
      });

      const session = await authService.login({
        email: "priya@demo.org",
        password: "password123",
      });

      expect(session.organization.purpose).toBe("");
      expect(session.organization.registrationNumber).toBe("");
    });
  });

  describe("requestOtp/verifyOtp — production vs. explicit mock-auth flag", () => {
    const originalFlag = process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH;

    afterEach(() => {
      if (originalFlag === undefined) {
        delete process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH;
      } else {
        process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = originalFlag;
      }
    });

    it("requestOtp() calls the real backend endpoint by default (flag unset)", async () => {
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH;
      vi.mocked(apiClient.post).mockResolvedValue({ message: "Code sent." });

      await authService.requestOtp({ email: "priya@demo.org" });

      expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.requestOtp, {
        email: "priya@demo.org",
      });
    });

    it("verifyOtp() calls the real backend endpoint by default and never compares against a fixed code", async () => {
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH;
      vi.mocked(apiClient.post).mockResolvedValue(apiSession);

      const session = await authService.verifyOtp({
        email: "priya@demo.org",
        code: "000000",
      });

      expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.verifyOtp, {
        email: "priya@demo.org",
        code: "000000",
      });
      expect(session.token).toBe("jwt-token");
    });

    it("verifyOtp() rejects whatever the backend rejects (flag unset) — no client-side '123456' short-circuit", async () => {
      delete process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH;
      vi.mocked(apiClient.post).mockRejectedValue({
        status: 401,
        message: "Invalid or expired code.",
      });

      await expect(
        authService.verifyOtp({ email: "priya@demo.org", code: "123456" }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it("requestOtp()/verifyOtp() use the isolated mock only when NEXT_PUBLIC_ENABLE_MOCK_AUTH=true", async () => {
      process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH = "true";
      const { mockOtpCodeForTests } = await import("@/services/auth/otp.mock");

      // The mock path resolves against the mock user directory, not the
      // (mocked-away) apiClient — apiClient must never be called here.
      await expect(
        authService.requestOtp({ email: "not-a-real-mock-user@example.com" }),
      ).rejects.toMatchObject({ status: 404 });
      expect(apiClient.post).not.toHaveBeenCalled();

      // A wrong code is rejected without ever reaching apiClient either.
      await expect(
        authService.verifyOtp({
          email: "not-a-real-mock-user@example.com",
          code: mockOtpCodeForTests(),
        }),
      ).rejects.toMatchObject({ status: 401 });
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });
});
