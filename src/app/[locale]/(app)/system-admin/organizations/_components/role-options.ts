import type { RoleSummary } from "@/services/roles/roles.types";

export type OrganizationRoleOption = Pick<
  RoleSummary,
  "id" | "key" | "name" | "enabled" | "crossEntity"
>;

// Only System Admin and System Reviewer are genuinely "external" — no entity
// account at all. Center Supervisor (NCNP Supervisor) is cross-entity in its
// *permissions* (view/follow every org's data) but still belongs to a real
// entity account like any other staff role — it's just System Admin who has
// to be the one to grant it (see UsersService's crossEntity privilege guard
// on the backend: only a crossEntity caller may assign a crossEntity role),
// not something an entity can self-service. citizen_guest has no login path
// at all, so it's never a real assignment target either way.
const INELIGIBLE_ORGANIZATION_ROLES = new Set([
  "system_admin",
  "system_reviewer",
  "citizen_guest",
]);

export function getAssignableOrganizationRoles<T extends OrganizationRoleOption>(
  roles: T[],
): T[] {
  return roles.filter(
    (role) => role.enabled && !INELIGIBLE_ORGANIZATION_ROLES.has(role.key),
  );
}
