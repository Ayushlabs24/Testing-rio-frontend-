import { users } from "@/mocks/data/users";
import {
  findOrganizationById,
  findRoleById,
  findUserById,
  isUserRoleEnabled,
} from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId, mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import { diffChanges } from "@/services/audit/audit.diff";
import { auditService } from "@/services/audit/audit.service";
import type {
  CreateUserForOrganizationPayload,
  CreateUserPayload,
  OrgUser,
  PlatformUser,
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

function requireAnyUser(id: string) {
  const user = users.find((u) => u.id === id);
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

function toPlatformUser(user: (typeof users)[number]): PlatformUser {
  const organization = findOrganizationById(user.organizationId);
  return {
    ...toOrgUser(user),
    organizationId: user.organizationId,
    organizationName: organization?.name ?? "—",
  };
}

export const usersService = {
  async listByOrganization(): Promise<OrgUser[]> {
    await mockDelay();
    const currentUser = requireCurrentUser();
    return users
      .filter(
        (user) =>
          user.organizationId === currentUser.organizationId && isUserRoleEnabled(user),
      )
      .map(toOrgUser);
  },

  /** Cross-entity — System Admin viewing any organization's members, not just their own. */
  async listByOrganizationId(organizationId: string): Promise<OrgUser[]> {
    await mockDelay();
    return users
      .filter((user) => user.organizationId === organizationId && isUserRoleEnabled(user))
      .map(toOrgUser);
  },

  /** Cross-entity — System Admin adding a member to an organization that isn't their own. */
  async createForOrganization({
    organizationId,
    name,
    email,
    roleId,
  }: CreateUserForOrganizationPayload): Promise<PlatformUser> {
    await mockDelay();
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
      organizationId,
      roleId,
      name,
      email,
      password: "password123",
      status: "invited" as const,
      consentedAt: null,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    return toPlatformUser(newUser);
  },

  async create({ name, email, roleId }: CreateUserPayload): Promise<PlatformUser> {
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
      // A creation has no "before" state, so each field's before value is null
      // (rendered as a hyphen in the audit trail) and after holds the new value.
      changes: [
        { field: "Name", before: null, after: newUser.name },
        { field: "Email", before: null, after: newUser.email },
        { field: "Role", before: null, after: findRoleById(roleId)?.name ?? roleId },
      ],
      metadata: { email: newUser.email, roleId: newUser.roleId },
    });
    return toPlatformUser(newUser);
  },

  async update(id: string, payload: UpdateUserPayload): Promise<OrgUser> {
    await mockDelay();
    const currentUser = requireCurrentUser();
    const user = requireOrgUser(id, currentUser.organizationId);

    if (payload.roleId && !findRoleById(payload.roleId)) {
      throw new ApiError({ message: "Unknown role.", status: 400 });
    }

    // Resolve role ids to their display names so the audit trail's before/after
    // values are human-readable rather than opaque ids.
    const roleName = (roleId: string) => findRoleById(roleId)?.name ?? roleId;
    const before = {
      name: user.name,
      role: roleName(user.roleId),
      status: user.status,
    };
    if (payload.name !== undefined) user.name = payload.name;
    if (payload.roleId !== undefined) user.roleId = payload.roleId;
    if (payload.status !== undefined) user.status = payload.status;
    const after = { name: user.name, role: roleName(user.roleId), status: user.status };
    auditService.record({
      action: "edit",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.name,
      changes: diffChanges(before, after, {
        name: "Name",
        role: "Role",
        status: "Status",
      }),
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
    // A deletion has no "after" state, so record what the record held before it
    // was removed; each after value is null (rendered as a hyphen).
    const removedChanges = [
      { field: "Name", before: removedName, after: null },
      { field: "Email", before: user.email, after: null },
      {
        field: "Role",
        before: findRoleById(user.roleId)?.name ?? user.roleId,
        after: null,
      },
    ];
    const index = users.indexOf(user);
    users.splice(index, 1);
    auditService.record({
      action: "delete",
      entityType: "user",
      entityId: id,
      entityLabel: removedName,
      changes: removedChanges,
    });
  },

  /** Cross-entity — System Admin sees every user, across every organization. */
  async listAll(): Promise<PlatformUser[]> {
    await mockDelay();
    return users.filter(isUserRoleEnabled).map(toPlatformUser);
  },

  /** Cross-entity — System Admin editing a user in any organization, not just their own. */
  async updateAny(id: string, payload: UpdateUserPayload): Promise<PlatformUser> {
    await mockDelay();
    const user = requireAnyUser(id);

    if (payload.roleId && !findRoleById(payload.roleId)) {
      throw new ApiError({ message: "Unknown role.", status: 400 });
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.roleId !== undefined) user.roleId = payload.roleId;
    if (payload.status !== undefined) user.status = payload.status;
    return toPlatformUser(user);
  },

  /** Cross-entity — System Admin removing a user from any organization. */
  async removeAny(id: string): Promise<void> {
    await mockDelay();
    const currentUser = requireCurrentUser();
    if (id === currentUser.id) {
      throw new ApiError({ message: "You can't remove your own account.", status: 400 });
    }
    const user = requireAnyUser(id);
    const index = users.indexOf(user);
    users.splice(index, 1);
  },
};
