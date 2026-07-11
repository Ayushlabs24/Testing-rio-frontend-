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

/** System Admin only — adding a member to an organization that isn't their own. */
export interface CreateUserForOrganizationPayload extends CreateUserPayload {
  organizationId: string;
}

/** System Admin's platform-wide Users view — an OrgUser plus which organization it belongs to. */
export interface PlatformUser extends OrgUser {
  organizationId: string;
  organizationName: string;
}

export interface UpdateUserPayload {
  name?: string;
  roleId?: string;
  status?: UserStatus;
}
