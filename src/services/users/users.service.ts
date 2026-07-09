import { users } from "@/mocks/data/users";
import { findRoleById, findUserById } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId, mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import { auditService } from "@/services/audit/audit.service";
import type {
  CreateUserPayload,
  OrgUser,
  UpdateUserPayload,
} from "@/services/users/users.types";

function requireCurrentUser() {
  const session = mockSession.read();
  const user = session ? findUserById(session.userId) : undefined;
  if (!user) {
    throw new ApiError({ message: "Not authenticated.", status: 401 });
  }
  return user;
}

function requireOrgUser(id: string, organizationId: string) {
  const user = users.find((u) => u.id === id && u.organizationId === organizationId);
  if (!user) {
    throw new ApiError({ message: "User not found.", status: 404 });
  }
  return user;
}

function toOrgUser(user: (typeof users)[number]): OrgUser {
  const role = findRoleById(user.roleId);
  if (!role) {
    throw new ApiError({ message: "Role not found for user.", status: 500 });
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: { id: role.id, key: role.key, name: role.name },
    status: user.status,
    createdAt: user.createdAt,
  };
}

export const usersService = {
  async listByOrganization(): Promise<OrgUser[]> {
    await mockDelay();
    const currentUser = requireCurrentUser();
    return users
      .filter((user) => user.organizationId === currentUser.organizationId)
      .map(toOrgUser);
  },

  async create({ name, email, roleId }: CreateUserPayload): Promise<OrgUser> {
    await mockDelay();
    const currentUser = requireCurrentUser();

    if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError({
        message: "An account with this email already exists.",
        status: 409,
      });
    }
    if (!findRoleById(roleId)) {
      throw new ApiError({ message: "Unknown role.", status: 400 });
    }

    const newUser = {
      id: generateId("user"),
      organizationId: currentUser.organizationId,
      roleId,
      name,
      email,
      // Mock-only: a real invite flow would email a set-password link instead.
      password: "password123",
      status: "active" as const,
      // Only the person themselves can consent — an admin inviting them
      // doesn't count. They'll be prompted on first login.
      consentedAt: null,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    auditService.record({
      action: "create",
      entityType: "user",
      entityId: newUser.id,
      entityLabel: newUser.name,
      metadata: { email: newUser.email, roleId: newUser.roleId },
    });
    return toOrgUser(newUser);
  },

  async update(id: string, payload: UpdateUserPayload): Promise<OrgUser> {
    await mockDelay();
    const currentUser = requireCurrentUser();
    const user = requireOrgUser(id, currentUser.organizationId);

    if (payload.roleId && !findRoleById(payload.roleId)) {
      throw new ApiError({ message: "Unknown role.", status: 400 });
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.roleId !== undefined) user.roleId = payload.roleId;
    if (payload.status !== undefined) user.status = payload.status;
    auditService.record({
      action: "edit",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.name,
      metadata: { changed: Object.keys(payload) },
    });
    return toOrgUser(user);
  },

  async remove(id: string): Promise<void> {
    await mockDelay();
    const currentUser = requireCurrentUser();
    if (id === currentUser.id) {
      throw new ApiError({ message: "You can't remove your own account.", status: 400 });
    }
    const user = requireOrgUser(id, currentUser.organizationId);
    const removedName = user.name;
    const index = users.indexOf(user);
    users.splice(index, 1);
    auditService.record({
      action: "delete",
      entityType: "user",
      entityId: id,
      entityLabel: removedName,
    });
  },
};
