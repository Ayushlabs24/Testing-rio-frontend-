import { roles as localRoles } from "@/mocks/data/roles";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { RoleSummary } from "@/services/roles/roles.types";
import type { ModulePermission } from "@/types/permissions";

/** Shape returned by the real backend's GET /roles (RoleDef, see role-matrix.ts). */
interface ApiRole {
  id: string;
  key: string;
  name: string;
  description: string;
  crossEntity: boolean;
  permissions: ModulePermission[];
}

/**
 * Roles are fixed and non-editable in this phase — read-only listing.
 * The backend's role matrix supplies the authorization data displayed on the
 * Roles page (`id`, `crossEntity`, `permissions`). `name`/`description` are
 * product-owned display copy — the frontend's local matrix has this session's
 * renames (e.g. "Reviewer / Approver" instead of the backend's "Human
 * Reviewer") that the backend doesn't track, so those two fields come from
 * there instead. `enabled` (is this role live for the current demo phase) is a
 * UI-only gate that doesn't exist server-side at all — same local-matrix
 * lookup by key.
 *
 * NOTE: this is the *display* source only. What's actually *enforced* at
 * runtime is the session role's `permissions`, which `authService` still
 * resolves from the local `roles.ts` matrix (the /auth/login|me response
 * carries only the role key, not its permissions). The two matrices are
 * expected to stay in sync; if they diverge, this page can show permissions
 * that differ from what `usePermission` enforces. Collapsing them onto a
 * single source (e.g. carrying permissions in the session payload) is the
 * proper long-term fix — tracked separately.
 */
export const rolesService = {
  async list(): Promise<RoleSummary[]> {
    const apiRoles = await apiClient.get<ApiRole[]>(endpoints.roles.list);
    return apiRoles.map((role) => {
      const local = localRoles.find((r) => r.key === role.key);
      return {
        ...role,
        name: local?.name ?? role.name,
        description: local?.description ?? role.description,
        enabled: local?.enabled ?? false,
      };
    });
  },
};
