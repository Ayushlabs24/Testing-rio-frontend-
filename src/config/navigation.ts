import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, ShieldCheck, Users2, Building2 } from "lucide-react";
import type { PermissionModule } from "@/types/permissions";

export interface NavItem {
  /** Key into the `app.sidebar` namespace of the message files. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Omit for items every authenticated user can see (e.g. Dashboard). */
  module?: PermissionModule;
}

export const appNav: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    labelKey: "organization",
    href: "/settings/organization",
    icon: Building2,
    module: "organization",
  },
  { labelKey: "roles", href: "/settings/roles", icon: ShieldCheck, module: "usersRoles" },
  { labelKey: "users", href: "/settings/users", icon: Users2, module: "usersRoles" },
];
