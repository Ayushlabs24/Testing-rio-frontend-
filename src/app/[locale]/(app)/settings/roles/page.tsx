"use client";

import { Eye, Globe2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ModuleAccessList } from "@/components/features/settings/module-access-list";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { rolesService } from "@/services/roles/roles.service";
import type { RoleSummary } from "@/services/roles/roles.types";
import type { ModulePermission } from "@/types/permissions";

interface PermissionCounts {
  full: number;
  read: number;
  custom: number;
  none: number;
}

/**
 * Mirrors `ModuleAccessList`'s three-tier `levelKey` (see that file) at the
 * card-summary level: `full` requires create + edit, not just edit, so a
 * role can't read as "Full Access to N modules" when it's actually missing
 * create rights on some of them.
 */
function countPermissions(permissions: ModulePermission[]): PermissionCounts {
  return permissions.reduce(
    (acc, permission) => {
      if (!permission.read) {
        acc.none += 1;
      } else if (permission.create && permission.write) {
        acc.full += 1;
      } else if (!permission.write && !permission.create) {
        acc.read += 1;
      } else {
        acc.custom += 1;
      }
      return acc;
    },
    { full: 0, read: 0, custom: 0, none: 0 },
  );
}

function AccessSummary({ role }: { role: RoleSummary }) {
  const t = useTranslations("app.settings.roles");
  const counts = countPermissions(role.permissions);
  const total = role.permissions.length;

  let summary: string;
  if (counts.full === total) {
    summary = t("access.summaryFull", { count: total });
  } else if (counts.none === total) {
    summary = t("access.summaryNone");
  } else {
    summary = t("access.summaryMixed", {
      full: counts.full,
      custom: counts.custom,
      read: counts.read,
      none: counts.none,
    });
  }

  return <p className="text-muted-foreground text-sm">{summary}</p>;
}

function RoleDetailSheet({
  role,
  open,
  onOpenChange,
}: {
  role: RoleSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("app.settings.roles");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        {role ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <SheetTitle>{role.name}</SheetTitle>
                  <SheetDescription>{role.description}</SheetDescription>
                </div>
              </div>
              {role.crossEntity ? (
                <Badge variant="outline" className="mt-2 w-fit gap-1.5">
                  <Globe2 className="size-3" />
                  {t("crossEntityBadge")}
                </Badge>
              ) : null}
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                {t("moduleColumn")}
              </p>
              <ModuleAccessList permissions={role.permissions} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RoleCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="bg-muted size-10 rounded-lg" />
          <div className="bg-muted h-4 w-28 rounded" />
        </div>
        <div className="bg-muted h-4 w-full rounded" />
        <div className="bg-muted h-4 w-2/3 rounded" />
        <div className="bg-muted h-8 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export default function RolesSettingsPage() {
  const t = useTranslations("app.settings.roles");
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    // Only enabled roles are shown — the team lead's current demo scope is
    // NGO Admin/Researcher/Approver/Supervisor; the rest stay fully defined
    // in roles.ts but aren't live yet. Nothing here changes when they return
    // beyond flipping `enabled` back on.
    rolesService
      .list()
      .then((allRoles) => setRoles(allRoles.filter((role) => role.enabled)));
  }, []);

  return (
    <PermissionGuard module="rolesPermissions" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles === null
            ? Array.from({ length: 4 }).map((_, index) => (
                <RoleCardSkeleton key={index} />
              ))
            : roles.map((role) => (
                <Card key={role.id}>
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <ShieldCheck className="size-5" />
                        </div>
                        <p className="text-foreground text-sm font-semibold">
                          {role.name}
                        </p>
                      </div>
                      {role.crossEntity ? (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[0.7rem]">
                          <Globe2 className="size-3" />
                          {t("crossEntityBadge")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-sm">
                      {role.description}
                    </p>
                    <AccessSummary role={role} />
                    <Button
                      className="w-full gap-2 px-4"
                      onClick={() => {
                        setSelectedRole(role);
                        setSheetOpen(true);
                      }}
                    >
                      <Eye className="size-4" />
                      {t("viewDetails")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
        </div>

        <RoleDetailSheet
          role={selectedRole}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
