import { useAuth } from "@/components/providers/auth-provider";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

/**
 * Gates UI on the current user's role permissions — used both for nav-item
 * visibility and in-page action buttons (e.g. hide "New user" unless the
 * role has write on "usersRoles").
 */
export function usePermission(
  module: PermissionModule,
  action: PermissionAction = "read",
): boolean {
  const { session } = useAuth();
  if (!session) return false;

  const permission = session.role.permissions.find((entry) => entry.module === module);
  if (!permission) return false;

  return action === "write" ? permission.write : permission.read;
}
