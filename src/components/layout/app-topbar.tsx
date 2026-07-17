"use client";

import { LogOut, Menu, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { OrgBrandMark } from "@/components/common/org-brand-mark";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { appNav } from "@/config/navigation";
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

/** Mobile equivalent of the sidebar's nav + profile footer — the sidebar
 * itself is hidden below `md`, so this Sheet is the only nav surface on
 * small screens and needs its own copy of both. */
function MobileNav() {
  const { session, logout } = useAuth();
  const t = useTranslations("app.sidebar");
  const tTopbar = useTranslations("app.topbar");
  const pathname = usePathname();
  const router = useRouter();

  if (!session) return null;

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const visibleNav = appNav.filter((item) => {
    if (!item.module) return true;
    // A disabled role (see roles.ts) can still sign in — `enabled` hides
    // module-scoped nav items, it doesn't block login itself.
    if (!session.role.enabled) return false;
    const permission = session.role.permissions.find(
      (entry) => entry.module === item.module,
    );
    return permission?.read ?? false;
  });

  return (
    <div className="flex h-[calc(100%-4rem)] flex-col">
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {visibleNav.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-foreground/70 hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                isActive && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="border-border border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="hover:bg-accent flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors"
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">
                  {session.user.name}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {session.role.name}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut /> {tTopbar("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface AppTopbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function AppTopbar({ collapsed, onToggleCollapsed }: AppTopbarProps) {
  const { session } = useAuth();
  const t = useTranslations("app.topbar");
  const tSidebar = useTranslations("app.sidebar");
  const pathname = usePathname();

  if (!session) return null;

  const currentNavItem = appNav.find((item) =>
    item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href),
  );

  return (
    <header className="border-border bg-background/80 sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label={tSidebar(collapsed ? "expand" : "collapse")}
          onClick={onToggleCollapsed}
        >
          <PanelLeft className="size-4" />
        </Button>

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={t("menu")}
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
            <div className="border-border flex h-16 min-w-0 items-center gap-2.5 border-b px-4 text-sm font-semibold">
              <OrgBrandMark
                logoUrl={session.organization.logoUrl}
                crossEntity={session.role.crossEntity}
              />
              <span className="min-w-0 flex-1 truncate">
                {session.role.crossEntity ? siteConfig.name : session.organization.name}
              </span>
            </div>
            <MobileNav />
          </SheetContent>
        </Sheet>

        {currentNavItem ? (
          <h1 className="text-foreground truncate text-base font-semibold">
            {tSidebar(currentNavItem.labelKey)}
          </h1>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
