import { roles } from "@/mocks/data/roles";
import { mockDelay } from "@/mocks/utils";
import type { RoleSummary } from "@/services/roles/roles.types";

/** Roles are fixed and non-editable in this phase — read-only listing. */
export const rolesService = {
  async list(): Promise<RoleSummary[]> {
    await mockDelay();
    return roles.map(({ id, key, name, description, crossEntity, permissions }) => ({
      id,
      key,
      name,
      description,
      crossEntity,
      permissions,
    }));
  },
};
