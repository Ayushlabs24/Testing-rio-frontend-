"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appNav } from "@/config/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {
  const { session } = useAuth();
  const t = useTranslations("app.sidebar");
  const pathname = usePathname();

  if (!session) return null;

  const { organization, role } = session;

  const visibleNav = appNav.filter((item) => {
    if (!item.module) return true;
    const permission = role.permissions.find((entry) => entry.module === item.module);
    return permission?.read ?? false;
  });

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "border-sidebar-border bg-sidebar hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="border-sidebar-border flex h-16 items-center gap-2.5 border-b px-4">
          <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold">
            {organization.name.charAt(0)}
          </span>
          {!collapsed ? (
            <span className="text-sidebar-foreground truncate text-sm font-semibold">
              {organization.name}
            </span>
          ) : null}
        </div>

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

        <div className="border-sidebar-border border-t p-3">
          {!collapsed ? (
            <p className="text-sidebar-foreground/60 mb-2 px-1 text-xs">{role.name}</p>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/70 w-full"
            aria-label={t(collapsed ? "expand" : "collapse")}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
