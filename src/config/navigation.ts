import type { LucideIcon } from "lucide-react";
import { Building2, LayoutDashboard, ShieldCheck, Users2 } from "lucide-react";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

export interface NavItem {
  /** Key into the `app.sidebar` namespace of the message files. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Omit for items every authenticated user can see (e.g. Dashboard). */
  module?: PermissionModule;
  /** Defaults to "read" — set "write" for items that need edit access, not just visibility. */
  action?: PermissionAction;
  /**
   * "entity" hides the item from cross-entity roles (System Admin, Center
   * Supervisor) — for concepts scoped to a single organization. "crossEntity"
   * is the inverse — for platform-wide screens those roles alone should see.
   * Omit for items every role's scope should see the same way.
   */
  scope?: "entity" | "crossEntity";
}

export const appNav: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    labelKey: "organization",
    href: "/settings/organization",
    icon: Building2,
    module: "entityTeam",
    scope: "entity",
  },
  {
    labelKey: "organizations",
    href: "/settings/organizations",
    icon: Building2,
    module: "entityTeam",
    action: "write",
    scope: "crossEntity",
  },
  {
    labelKey: "roles",
    href: "/settings/roles",
    icon: ShieldCheck,
    module: "rolesPermissions",
  },
  {
    labelKey: "users",
    href: "/settings/users",
    icon: Users2,
    module: "entityTeam",
  },
];
