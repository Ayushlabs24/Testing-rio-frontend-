import { useAuth } from "@/components/providers/auth-provider";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

/**
 * Gates UI on the current user's role permissions — used both for nav-item
 * visibility and in-page action buttons (e.g. hide "New user" unless the
 * role has write on "entityTeam").
 */
export function usePermission(
  module: PermissionModule,
  action: PermissionAction = "read",
): boolean {
  const { session } = useAuth();
  if (!session) return false;
  // A disabled role (see roles.ts) can still sign in — `enabled` gates
  // every module-scoped page/action, not authentication itself. This is
  // the single choke point: PermissionGuard, SystemAdminGuard, and every
  // in-page action button all route through this hook.
  if (!session.role.enabled) return false;

  const permission = session.role.permissions.find((entry) => entry.module === module);
  if (!permission) return false;

  return action === "write" ? permission.write : permission.read;
}
