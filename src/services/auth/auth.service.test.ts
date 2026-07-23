import { beforeEach, describe, expect, it, vi } from "vitest";
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
    region: null,
    email: null,
    sector: null,
    villages: [],
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

  it("signup() posts the full payload to /auth/signup and surfaces a fallback temporary password when not emailed", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...apiSession,
      temporaryPasswordEmailed: false,
      temporaryPassword: "temp-pw-123",
    });

    const payload = {
      organizationName: "Demo NGO",
      sector: "healthcare",
      registrationNumber: "REG-1",
      email: "priya@demo.org",
      regionId: "r1",
      governorateIds: ["g1"],
      centerIds: ["c1"],
    };
    const result = await authService.signup(payload);

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.signup, payload);
    expect(result.session.organization.name).toBe("Demo NGO");
    expect(result.session.role.key).toBe("ngo_admin");
    expect(result.temporaryPasswordEmailed).toBe(false);
    expect(result.temporaryPassword).toBe("temp-pw-123");
  });

  it("signup() omits temporaryPassword when the backend emailed it instead", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...apiSession,
      temporaryPasswordEmailed: true,
    });

    const result = await authService.signup({
      organizationName: "Demo NGO",
      sector: "healthcare",
      registrationNumber: "REG-1",
      email: "priya@demo.org",
      regionId: "r1",
      governorateIds: ["g1"],
      centerIds: ["c1"],
    });

    expect(result.temporaryPasswordEmailed).toBe(true);
    expect(result.temporaryPassword).toBeUndefined();
  });

  it("signup() omits temporaryPassword when the backend doesn't return one (production, mailer not configured)", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...apiSession,
      temporaryPasswordEmailed: false,
    });

    const result = await authService.signup({
      organizationName: "Demo NGO",
      sector: "healthcare",
      registrationNumber: "REG-1",
      email: "priya@demo.org",
      regionId: "r1",
      governorateIds: ["g1"],
      centerIds: ["c1"],
    });

    expect(result.temporaryPasswordEmailed).toBe(false);
    expect(result.temporaryPassword).toBeUndefined();
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

    const session = await authService.giveConsent();

    expect(apiClient.post).toHaveBeenCalledWith(endpoints.auth.consent);
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
      role: { key: "not_a_real_role" },
    });

    await expect(
      authService.login({ email: "priya@demo.org", password: "password123" }),
    ).rejects.toMatchObject({ status: 500 });
  });
});
