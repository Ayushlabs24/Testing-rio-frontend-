export type UserStatus = "active" | "invited";

export interface UserRoleSummary {
  id: string;
  key: string;
  name: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleSummary;
  status: UserStatus;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roleId: string;
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
}
