"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collapsed: boolean;
}

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const { session } = useAuth();
  const t = useTranslations("app.sidebar");
  const pathname = usePathname();

  if (!session) return null;

  const { organization, role } = session;

  const visibleNav = appNav.filter((item) => {
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
  });

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "border-sidebar-border bg-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {!collapsed ? (
          <div className="border-sidebar-border flex h-16 min-w-0 items-center gap-2.5 border-b px-4">
            {role.crossEntity ? (
              <>
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="text-sidebar-foreground min-w-0 flex-1 text-sm font-semibold">
                  {siteConfig.name}
                </span>
              </>
            ) : (
              <>
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold">
                  {organization.name.charAt(0)}
                </span>
                <span
                  className="text-sidebar-foreground min-w-0 flex-1 text-sm font-semibold break-words"
                  title={organization.name}
                >
                  {organization.name}
                </span>
              </>
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
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
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
      </aside>
    </TooltipProvider>
  );
}
