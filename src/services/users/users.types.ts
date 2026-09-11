export type UserStatus = "active" | "invited" | "disabled";

export interface UserRoleSummary {
  id: string;
  key: string;
  name: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  /** RIO MFA — null when this user hasn't supplied one (no OTP-over-SMS sign-in). */
  mobileNumber: string | null;
  role: UserRoleSummary;
  status: UserStatus;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roleId: string;
  /** RIO MFA — optional; enables "Sign in with OTP" over SMS for this user. */
  mobileNumber?: string;
}

/** Same pattern as signup: a temporary password is generated server-side,
 * emailed if possible, and surfaced back here (dev-only) when it isn't —
 * so the admin can hand it to the new user some other way. */
export interface CreateUserResponse extends OrgUser {
  temporaryPasswordEmailed: boolean;
  temporaryPassword?: string;
}

/** Center Supervisor's platform-wide Users view — an OrgUser plus which organization it belongs to. */
export interface PlatformUser extends OrgUser {
  organizationId: string;
  organizationName: string;
}

export interface UpdateUserPayload {
  name?: string;
  roleId?: string;
  status?: UserStatus;
  /** RIO MFA — set/change/clear ('' clears it) an existing user's mobile number. */
  mobileNumber?: string;
}

export interface UpdateUserStatusPayload {
  status: UserStatus;
  reason?: string;
}

export interface AssignNgoAdminPayload {
  userId?: string;
  name?: string;
  email?: string;
  reason?: string;
}
