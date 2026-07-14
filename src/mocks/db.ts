import { organizations, type MockOrganization } from "@/mocks/data/organizations";
import { roles, type Role } from "@/mocks/data/roles";
import { users, type MockUser } from "@/mocks/data/users";

export interface AuthedContext {
  user: MockUser;
  organization: MockOrganization;
  role: Role;
}

/** Resolves a user's org + role in one call — the shape every auth response needs. */
export function resolveContext(user: MockUser): AuthedContext {
  const organization = organizations.find((org) => org.id === user.organizationId);
  const role = roles.find((r) => r.id === user.roleId);

  if (!organization || !role) {
    throw new Error(`Mock data integrity error for user ${user.id}`);
  }

  return { user, organization, role };
}

export function findUserByEmail(email: string): MockUser | undefined {
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): MockUser | undefined {
  return users.find((u) => u.id === id);
}
