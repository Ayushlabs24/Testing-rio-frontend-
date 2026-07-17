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
  // the single choke point: PermissionGuard, CrossEntityGuard, and every
  // in-page action button all route through this hook.
  if (!session.role.enabled) return false;

  const permission = session.role.permissions.find((entry) => entry.module === module);
  if (!permission) return false;

  // Indexed, not branched: every grant resolves to its own field. An earlier
  // version read `action === "write" ? permission.write : permission.read`,
  // which would answer a `create`/`approve`/`export`/`share` check with the
  // role's `read` grant — fail-open on exactly the actions that gate
  // mutations.
  return permission[action] === true;
}
