import type { PermissionAction, PermissionModule } from "@/types/permissions";

export interface PermissionGrant {
  id: string;
  granteeId: string;
  granteeName: string | null;
  module: PermissionModule;
  action: PermissionAction;
  targetOrgId: string | null;
  targetOrgName: string | null;
  reason: string;
  grantedBy: string;
  grantedByName: string | null;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedByName: string | null;
  isActive: boolean;
}

export interface CreatePermissionGrantPayload {
  granteeId: string;
  module: PermissionModule;
  action: PermissionAction;
  targetOrgId?: string;
  reason: string;
  expiresAt?: string;
}
