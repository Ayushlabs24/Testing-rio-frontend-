import type { ModulePermission } from "@/types/permissions";

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  crossEntity: boolean;
  /** Whether this role is assignable/visible/loginable right now — see roles.ts. */
  enabled: boolean;
  permissions: ModulePermission[];
}
