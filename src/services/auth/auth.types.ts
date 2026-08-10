import type { ModulePermission } from "@/types/permissions";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  consentedAt: string | null;
  /**
   * The policy version `consentedAt` corresponds to — compared against the
   * currently-active policy's version (GET /consent-policy/active) to
   * decide whether ConsentGuard should re-prompt (e.g. after a policy
   * version bump), rather than trusting the merely-truthy `consentedAt`.
   */
  consentedPolicyVersion: string | null;
}

export interface AuthOrganization {
  id: string;
  name: string;
  purpose: string;
  registrationNumber: string;
  logoUrl: string | null;
  region: string[];
  email: string;
  /** A live Methodology Configuration domain name (e.g. "Health"), or
   * "other" (paired with `purpose` for free text) — never a fixed enum. */
  sector: string | null;
  villages: string[];
  regionId: string | null;
  governorateIds: string[];
  centerIds: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AuthRole {
  id: string;
  key: string;
  name: string;
  crossEntity: boolean;
  /**
   * Whether this role is live for the current phase (see roles.ts). A
   * disabled role can still authenticate — `enabled` gates the UI (nav
   * visibility, route guards via `usePermission`), never login itself, so
   * flipping a role back on is a pure UI change with no session/auth-layer
   * side effects.
   */
  enabled: boolean;
  permissions: ModulePermission[];
}

/** Everything a signed-in client needs — user, their org, their role/permissions. */
export interface SessionContext {
  token: string;
  user: AuthUser;
  organization: AuthOrganization;
  role: AuthRole;
  /**
   * True until this user sets their own password via
   * `authService.changePassword()` — every signup-issued account starts
   * here with a system-generated temp password, never one they chose. See
   * `PasswordChangeGuard`, which blocks the app until this clears.
   */
  mustChangePassword: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * Public signup: creates a new organization and its first NGO Admin
 * together. No `adminName`/`password` fields — the email itself *is* the
 * NGO Admin account, and the backend issues a temporary password (see
 * `SignupResult`) rather than taking one from the form.
 */
export interface SignupPayload {
  organizationName: string;
  sector: string;
  /**
   * Only meaningful when `sector` is `"other"` — the org's own free-text
   * description of what that is. Mirrors Settings > Organization's own
   * sector/"specify other" pattern, so `purpose` is no longer a general
   * free-text "area of work" field on its own.
   */
  purpose?: string;
  registrationNumber: string;
  email: string;
  /** KSA Geographic Reference hierarchy — mandatory at signup so the org's
   * scope is configured from the start (still editable later via
   * Settings > Organization). */
  regionId: string;
  governorateIds: string[];
  centerIds: string[];
}

/**
 * `authService.signup()`'s return value. RIO-FR-010 (client-confirmed):
 * self-registration requires Center (System Admin) approval before
 * activation — no session is issued at signup anymore, and no temporary
 * password is shown or emailed yet. Both happen once a System Admin
 * approves the entity (see OrganizationsService.approve on the backend);
 * the entity logs in normally via POST /auth/login once that's done.
 */
export interface SignupResult {
  status: "pending_approval";
  organizationName: string;
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface RequestOtpPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}
