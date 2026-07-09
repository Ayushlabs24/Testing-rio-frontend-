"use client";

import { Eye, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rolesService } from "@/services/roles/roles.service";
import type { RoleSummary } from "@/services/roles/roles.types";
import type { ModulePermission } from "@/types/permissions";

interface PermissionCounts {
  full: number;
  read: number;
  none: number;
}

function countPermissions(permissions: ModulePermission[]): PermissionCounts {
  return permissions.reduce(
    (acc, permission) => {
      if (permission.read && permission.write) {
        acc.full += 1;
      } else if (permission.read) {
        acc.read += 1;
      } else {
        acc.none += 1;
      }
      return acc;
    },
    { full: 0, read: 0, none: 0 },
  );
}

function AccessSummary({ role }: { role: RoleSummary }) {
  const t = useTranslations("app.settings.roles");
  const counts = countPermissions(role.permissions);
  const total = role.permissions.length;

  return (
    <div className="flex w-full max-w-[180px] flex-col gap-1.5">
      <div className="bg-muted flex h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary"
          style={{ width: `${(counts.full / total) * 100}%` }}
        />
        <div
          className="bg-secondary"
          style={{ width: `${(counts.read / total) * 100}%` }}
        />
        <div
          className="bg-border"
          style={{ width: `${(counts.none / total) * 100}%` }}
        />
      </div>
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>
          {counts.full} {t("access.fullShort")}
        </span>
        <span>
          {counts.read} {t("access.readShort")}
        </span>
        <span>{counts.none} —</span>
      </div>
    </div>
  );
}

function RoleDialog({ role, trigger }: { role: RoleSummary; trigger: React.ReactNode }) {
  const t = useTranslations("app.settings.roles");
  const tModules = useTranslations("app.settings.roles.modules");

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle>{role.name}</DialogTitle>
              <DialogDescription>{role.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-4 pb-1 text-xs font-medium">
            <span>{t("moduleColumn")}</span>
            <span className="w-12 text-center">{t("read")}</span>
            <span className="w-12 text-center">{t("write")}</span>
          </div>
          <Separator />
          {role.permissions.map((permission) => (
            <div
              key={permission.module}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2"
            >
              <span className="text-foreground text-sm">
                {tModules(permission.module)}
              </span>
              <span className="flex w-12 justify-center">
                <Checkbox checked={permission.read} disabled />
              </span>
              <span className="flex w-12 justify-center">
                <Checkbox checked={permission.write} disabled />
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RolesSettingsPage() {
  const t = useTranslations("app.settings.roles");
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);

  useEffect(() => {
    rolesService.list().then(setRoles);
  }, []);

  return (
    <PermissionGuard module="usersRoles" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">{t("roleColumn")}</TableHead>
                  <TableHead>{t("descriptionColumn")}</TableHead>
                  <TableHead className="w-[240px]">{t("accessColumn")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles === null
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="bg-muted size-8 rounded-md" />
                            <div className="bg-muted h-4 w-24 rounded" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="bg-muted h-4 w-48 rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="bg-muted h-6 w-32 rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="bg-muted ml-auto h-8 w-8 rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  : roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="text-foreground font-medium">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
                          <ShieldCheck className="size-4" />
                        </div>
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {role.description}
                    </TableCell>
                    <TableCell>
                      <AccessSummary role={role} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RoleDialog
                        role={role}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={t("viewDetails")}>
                            <Eye className="size-4" />
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
