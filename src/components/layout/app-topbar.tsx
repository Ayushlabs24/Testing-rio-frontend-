"use client";

import { LogOut, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
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

function MobileNav() {
  const { session } = useAuth();
  const t = useTranslations("app.sidebar");
  const pathname = usePathname();

  if (!session) return null;

  const visibleNav = appNav.filter((item) => {
    if (!item.module) return true;
    const permission = session.role.permissions.find(
      (entry) => entry.module === item.module,
    );
    return permission?.read ?? false;
  });

  return (
    <nav className="flex flex-col gap-1 p-4">
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
  );
}

export function AppTopbar() {
  const { session, logout } = useAuth();
  const t = useTranslations("app.topbar");
  const tSidebar = useTranslations("app.sidebar");
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (!session) return null;

  const currentNavItem = appNav.find((item) =>
    item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href),
  );

  return (
    <header className="border-border bg-background/80 sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-3">
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
            <div className="border-border flex h-16 items-center border-b px-4 text-sm font-semibold">
              {session.organization.name}
            </div>
            <MobileNav />
          </SheetContent>
        </Sheet>

        {currentNavItem ? (
          <h1 className="text-foreground text-base font-semibold">
            {tSidebar(currentNavItem.labelKey)}
          </h1>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto gap-2 rounded-full px-2 py-1.5">
              <Avatar className="size-8">
                <AvatarFallback>{initials(session.user.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-left sm:block">
                <span className="text-foreground block text-sm font-medium">
                  {session.user.name}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {session.role.name}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut /> {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
