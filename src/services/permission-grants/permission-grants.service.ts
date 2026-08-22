import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreatePermissionGrantPayload,
  PermissionGrant,
} from "@/services/permission-grants/permission-grants.types";

export const permissionGrantsService = {
  async list(): Promise<PermissionGrant[]> {
    return apiClient.get<PermissionGrant[]>(endpoints.permissionGrants.list);
  },
  async create(payload: CreatePermissionGrantPayload): Promise<PermissionGrant> {
    return apiClient.post<PermissionGrant>(endpoints.permissionGrants.list, payload);
  },
  async revoke(id: string): Promise<PermissionGrant> {
    return apiClient.patch<PermissionGrant>(endpoints.permissionGrants.revoke(id));
  },
};
