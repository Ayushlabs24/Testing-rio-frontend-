"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { OrgBrandMark } from "@/components/common/org-brand-mark";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appNav, NAV_ORDER_BY_ROLE, type NavItem } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const { session, logout } = useAuth();
  const t = useTranslations("app.sidebar");
  const tTopbar = useTranslations("app.topbar");
  const pathname = usePathname();
  const router = useRouter();

  if (!session) return null;

  const { organization, role } = session;

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  function isPermitted(item: NavItem): boolean {
    if (item.scope === "entity" && role.crossEntity) return false;
    if (item.scope === "crossEntity" && !role.crossEntity) return false;
    if (!item.module) return true;
    // A disabled role (see roles.ts) can still sign in — `enabled` hides
    // module-scoped nav items, it doesn't block login itself.
    if (!role.enabled) return false;
    const permission = role.permissions.find((entry) => entry.module === item.module);
    return item.action === "write"
      ? (permission?.write ?? false)
      : (permission?.read ?? false);
  }

  // Order comes from this role's explicit list (NAV_ORDER_BY_ROLE) — not
  // array position in `appNav` — so "Dashboard first, then Studies, then..."
  // for a given role is answered by that config, never by incidental
  // filtering of one shared order. The permission check stays as a
  // fail-closed safety net: a role whose config lists an item it doesn't
  // actually hold the permission for still won't see it.
  const order = NAV_ORDER_BY_ROLE[role.key] ?? appNav.map((item) => item.labelKey);
  const byLabelKey = new Map(appNav.map((item) => [item.labelKey, item]));
  const visibleNav = order
    .map((labelKey) => byLabelKey.get(labelKey))
    .filter((item): item is NavItem => item !== undefined && isPermitted(item));

  const profileMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group hover:bg-sidebar-accent aria-expanded:bg-sidebar-accent flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
            collapsed && "justify-center px-0",
          )}
          aria-label={session.user.name}
        >
          <Avatar className="size-8 shrink-0">
            <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="text-sidebar-foreground group-hover:text-sidebar-accent-foreground group-aria-expanded:text-sidebar-accent-foreground block text-sm font-medium break-words">
                {session.user.name}
              </span>
              <span className="text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground/80 group-aria-expanded:text-sidebar-accent-foreground/80 block truncate text-xs">
                {role.name}
              </span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut /> {tTopbar("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "border-sidebar-border bg-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {!collapsed ? (
          <div className="border-sidebar-border flex h-16 min-w-0 items-center gap-2.5 border-b px-4">
            <OrgBrandMark logoUrl={organization.logoUrl} crossEntity={role.crossEntity} />
            {role.crossEntity ? (
              <span className="text-sidebar-foreground min-w-0 flex-1 text-sm font-semibold">
                {siteConfig.name}
              </span>
            ) : (
              <span
                className="text-sidebar-foreground min-w-0 flex-1 text-sm font-semibold break-words"
                title={organization.name}
              >
                {organization.name}
              </span>
            )}
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleNav.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const label = t(item.labelKey);

            const link = (
              <Link
                key={item.href}
                href={item.href}
                aria-label={label}
                className={cn(
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed ? label : null}
              </Link>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="border-sidebar-border border-t p-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{profileMenu}</TooltipTrigger>
              <TooltipContent side="right">{session.user.name}</TooltipContent>
            </Tooltip>
          ) : (
            profileMenu
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
