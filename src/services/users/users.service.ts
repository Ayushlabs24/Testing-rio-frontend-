import { organizationsService } from "@/services/organizations/organizations.service";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  AssignNgoAdminPayload,
  CreateUserPayload,
  CreateUserResponse,
  OrgUser,
  PlatformUser,
  UpdateUserPayload,
  UserStatus,
} from "@/services/users/users.types";

export const usersService = {
  async listByOrganization(): Promise<OrgUser[]> {
    return apiClient.get<OrgUser[]>(endpoints.users.list);
  },

  /** Cross-entity, read-only — Center Supervisor viewing any organization's members. */
  async listByOrganizationId(organizationId: string): Promise<OrgUser[]> {
    return apiClient.get<OrgUser[]>(endpoints.users.list, {
      params: { organizationId },
    });
  },

  /** System Admin: list users for a specific organization via /organizations/:id/users */
  async listForOrg(organizationId: string): Promise<OrgUser[]> {
    return apiClient.get<OrgUser[]>(endpoints.organizations.usersForOrg(organizationId));
  },

  /** System Admin: fetch NGO Admins for a specific organization. */
  async getNgoAdminsForOrg(organizationId: string): Promise<OrgUser[]> {
    return apiClient.get<OrgUser[]>(
      endpoints.organizations.ngoAdminsForOrg(organizationId),
    );
  },

  /** System Admin: assign or change NGO Admin for an organization. */
  async assignNgoAdmin(
    organizationId: string,
    payload: AssignNgoAdminPayload,
  ): Promise<CreateUserResponse> {
    return apiClient.post<CreateUserResponse>(
      endpoints.organizations.assignNgoAdmin(organizationId),
      payload,
    );
  },

  /** System Admin: update a user's role in a specific organization. */
  async updateRoleForOrg(
    organizationId: string,
    userId: string,
    payload: { roleId: string; reason?: string },
  ): Promise<OrgUser> {
    return apiClient.patch<OrgUser>(
      endpoints.organizations.updateUserRoleForOrg(organizationId, userId),
      payload,
    );
  },

  /** System Admin: update a user's status (active | disabled) in a specific organization. */
  async updateStatusForOrg(
    organizationId: string,
    userId: string,
    payload: { status: UserStatus; reason?: string },
  ): Promise<OrgUser> {
    return apiClient.patch<OrgUser>(
      endpoints.organizations.updateUserStatusForOrg(organizationId, userId),
      payload,
    );
  },

  /** System Admin: resend invitation for a user in a specific organization. */
  async resendInviteForOrg(
    organizationId: string,
    userId: string,
  ): Promise<CreateUserResponse> {
    return apiClient.post<CreateUserResponse>(
      endpoints.organizations.resendInviteForOrg(organizationId, userId),
    );
  },

  /** System Admin: create/invite user in a specific organization. */
  async createForOrg(
    organizationId: string,
    payload: CreateUserPayload,
  ): Promise<CreateUserResponse> {
    return apiClient.post<CreateUserResponse>(
      endpoints.organizations.usersForOrg(organizationId),
      payload,
    );
  },

  async create(payload: CreateUserPayload): Promise<CreateUserResponse> {
    return apiClient.post<CreateUserResponse>(endpoints.users.create, payload);
  },

  async update(id: string, payload: UpdateUserPayload): Promise<OrgUser> {
    return apiClient.patch<OrgUser>(endpoints.users.byId(id), payload);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(endpoints.users.byId(id));
  },

  /** Cross-entity, read-only — every user, across every organization. */
  async listAll(): Promise<PlatformUser[]> {
    const organizations = await organizationsService.listAll();
    const perOrg = await Promise.all(
      organizations.map((org) =>
        usersService.listByOrganizationId(org.id).then((orgUsers) =>
          orgUsers.map((user) => ({
            ...user,
            organizationId: org.id,
            organizationName: org.name,
          })),
        ),
      ),
    );
    return perOrg.flat();
  },
};
