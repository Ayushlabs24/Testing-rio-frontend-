import type { RoleSummary } from "@/services/roles/roles.types";

export type OrganizationRoleOption = Pick<
  RoleSummary,
  "id" | "key" | "name" | "enabled" | "crossEntity"
>;

const INELIGIBLE_ORGANIZATION_ROLES = new Set([
  "system_admin",
  "center_supervisor",
  "citizen_guest",
]);

export function getAssignableOrganizationRoles<T extends OrganizationRoleOption>(
  roles: T[],
): T[] {
  return roles.filter(
    (role) =>
      role.enabled && !role.crossEntity && !INELIGIBLE_ORGANIZATION_ROLES.has(role.key),
  );
}
