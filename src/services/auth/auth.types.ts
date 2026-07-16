import type { Sector } from "@/config/sectors";
import type { ModulePermission } from "@/types/permissions";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  consentedAt: string | null;
}

export interface AuthOrganization {
  id: string;
  name: string;
  purpose: string;
  registrationNumber: string;
  logoUrl: string | null;
  region: string[];
  email: string;
  sector: Sector | null;
  villages: string[];
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
  /**
   * RIO-FR-Add-02: the backend's `SignupBody` rejects anything but the
   * literal `true` — consent is structurally mandatory, not just a value
   * the form happens to send. The active policy version itself isn't part
   * of this payload: the backend looks up whichever policy is active at
   * signup time itself (see AuthRepository.createOrganisationAndAdmin) and
   * records that version's acceptance, rather than trusting a
   * client-supplied version.
   */
  consentAccepted: true;
}

/**
 * `authService.signup()`'s return value. `temporaryPasswordEmailed: true`
 * means the backend actually emailed the new admin their temporary
 * password (see the backend's `MailerService`) — nothing further to show.
 * When `false`, the mailer isn't configured yet (or the send failed), so
 * `temporaryPassword` carries a one-time in-app reveal instead — only
 * present outside production (see the backend's `AuthService.signup()`).
 */
export interface SignupResult {
  session: SessionContext;
  temporaryPasswordEmailed: boolean;
  temporaryPassword?: string;
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
