"use client";

import { Bell, LogOut, Menu, PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { OrgBrandMark } from "@/components/common/org-brand-mark";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { appNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import {
  markReviewerSlaAlertsSeen,
  useReviewerSlaBadge,
} from "@/hooks/use-reviewer-sla-badge";
import { useSharingNotifications } from "@/hooks/use-sharing-notifications";
import type { SharingNotification } from "@/hooks/use-sharing-notifications";
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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Single combined bell for every in-app alert source — Reviewer SLA
 * (useReviewerSlaBadge) and report/study sharing-request events
 * (useSharingNotifications). Previously two separate bells; consolidated
 * into one icon with one dropdown per feedback that a second bell wasn't
 * worth the extra chrome. Reviewer SLA surfaces as a single summary row
 * linking to its own dedicated page (visiting it already marks its alerts
 * seen — see reviewer-sla/page.tsx); Sharing surfaces as the same
 * itemized, click-to-navigate list as before. */
function NotificationsBell({
  canSeeReviewerSla,
  canSeeSharing,
}: {
  canSeeReviewerSla: boolean;
  canSeeSharing: boolean;
}) {
  const t = useTranslations("app.topbar");
  const router = useRouter();
  const { session } = useAuth();
  const reviewerSla = useReviewerSlaBadge();
  const {
    notifications,
    unreadCount: sharingUnreadCount,
    markSeen,
    markAllSeen,
  } = useSharingNotifications();
  const [open, setOpen] = useState(false);

  const reviewerSlaCount = canSeeReviewerSla ? reviewerSla.count : 0;
  const sharingCount = canSeeSharing ? sharingUnreadCount : 0;
  const totalCount = reviewerSlaCount + sharingCount;

  // Same color language as the Reviewer SLA Alerts page's own status
  // badges (STATUS_VARIANT in reviewer-sla/page.tsx) — breached escalates
  // to destructive, at_risk to the brand/default color; sharing activity
  // alone (no reviewer alerts) stays a neutral secondary, since a new
  // sharing request isn't an urgency/SLA signal.
  const badgeVariant =
    reviewerSlaCount > 0 && reviewerSla.severity === "breached"
      ? "destructive"
      : reviewerSlaCount > 0 && reviewerSla.severity === "at_risk"
        ? "default"
        : "secondary";

  function labelFor(n: SharingNotification): string {
    const key =
      n.type === "request_created"
        ? n.entity === "study"
          ? "sharingAlertCreatedStudy"
          : "sharingAlertCreatedReport"
        : n.type === "request_approved"
          ? n.entity === "study"
            ? "sharingAlertApprovedStudy"
            : "sharingAlertApprovedReport"
          : n.entity === "study"
            ? "sharingAlertRejectedStudy"
            : "sharingAlertRejectedReport";
    return t(key, { orgName: n.orgName, title: n.title });
  }

  function handleSharingClick(n: SharingNotification) {
    markSeen(n.id);
    setOpen(false);
    const tab = n.type === "request_created" ? "incoming" : "outgoing";
    router.push(
      `/sharing?entity=${n.entity === "study" ? "studies" : "reports"}&tab=${tab}`,
    );
  }

  function handleMarkAllSeen() {
    if (canSeeSharing) markAllSeen();
    if (canSeeReviewerSla && session?.user.id) {
      markReviewerSlaAlertsSeen(session.user.id, reviewerSla.alerts);
    }
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("notifications")}
        >
          <Bell className="size-4" />
          {totalCount > 0 ? (
            <Badge
              variant={badgeVariant}
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums"
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">{t("notifications")}</DropdownMenuLabel>
          {totalCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllSeen}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t("sharingAlertsMarkAllSeen")}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        {canSeeReviewerSla && reviewerSlaCount > 0 ? (
          <DropdownMenuItem asChild onClick={() => setOpen(false)}>
            <Link href="/reviewer-sla" className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  reviewerSla.severity === "breached"
                    ? "bg-destructive"
                    : reviewerSla.severity === "at_risk"
                      ? "bg-primary"
                      : "bg-muted-foreground",
                )}
              />
              <span className="text-sm">
                {t("reviewerSlaPendingCount", { count: reviewerSlaCount })}
              </span>
            </Link>
          </DropdownMenuItem>
        ) : null}

        {canSeeReviewerSla && reviewerSlaCount > 0 && canSeeSharing ? (
          <DropdownMenuSeparator />
        ) : null}

        {canSeeSharing ? (
          notifications.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              {t("sharingAlertsEmpty")}
            </p>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleSharingClick(n)}
                className="flex flex-col items-start gap-0.5 whitespace-normal"
              >
                <span className={cn("text-sm", !n.seen && "font-medium")}>
                  {labelFor(n)}
                </span>
                {n.reason ? (
                  <span className="text-muted-foreground text-xs">
                    {t("sharingAlertReasonPrefix", { reason: n.reason })}
                  </span>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {timeAgo(n.createdAt)}
                </span>
              </DropdownMenuItem>
            ))
          )
        ) : null}

        {!canSeeSharing && reviewerSlaCount === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-sm">
            {t("sharingAlertsEmpty")}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
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

  // Same permission gate as the Reviewer SLA nav item itself (see
  // config/navigation.ts's `module: "aiReview"` entry, and MobileNav's
  // identical `visibleNav` filter above) — the bell only ever shows for a
  // role that can actually see that page.
  const canSeeReviewerSla =
    session.role.enabled &&
    (session.role.permissions.find((p) => p.module === "aiReview")?.read ?? false);
  const canSeeSharing =
    session.role.enabled &&
    (session.role.permissions.find((p) => p.module === "archiveSharingAudit")?.read ??
      false);

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
              <span className="min-w-0 flex-1 break-words">
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
        {canSeeReviewerSla || canSeeSharing ? (
          <NotificationsBell
            canSeeReviewerSla={canSeeReviewerSla}
            canSeeSharing={canSeeSharing}
          />
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
