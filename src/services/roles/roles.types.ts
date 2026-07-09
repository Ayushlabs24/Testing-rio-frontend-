import type { ModulePermission } from "@/types/permissions";

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: ModulePermission[];
}
