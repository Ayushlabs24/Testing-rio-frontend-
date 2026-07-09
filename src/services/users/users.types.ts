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

export interface UpdateUserPayload {
  name?: string;
  roleId?: string;
  status?: UserStatus;
}
