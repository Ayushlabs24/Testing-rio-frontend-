import { organizationsService } from "@/services/organizations/organizations.service";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateUserPayload,
  OrgUser,
  PlatformUser,
  UpdateUserPayload,
} from "@/services/users/users.types";

/**
 * All methods here call the real backend (see users.controller.ts).
 * `listAll` has no single "every user across every org" backend endpoint,
 * so it's built by combining the real `organizationsService.listAll()`
 * with a real per-org `listByOrganizationId()` call for each — the
 * platform-wide view Center Supervisor (the one remaining cross-entity,
 * read-only role) needs. There is no cross-org write path anymore: System
 * Admin (the only role that ever had one) is disabled, so create/edit/
 * delete always go through the entity-scoped methods below.
 */
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

  async create(payload: CreateUserPayload): Promise<OrgUser> {
    return apiClient.post<OrgUser>(endpoints.users.create, payload);
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
