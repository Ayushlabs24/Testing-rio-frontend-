"use client";

import { Building2, Eye, Users2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { useAuth } from "@/components/providers/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function OrganizationDetailSheet({
  organizationId,
  open,
  onOpenChange,
}: {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("app.settings.organizations");
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [members, setMembers] = useState<OrgUser[] | null>(null);

  useEffect(() => {
    if (!organizationId || !open) return;
    organizationsService.getById(organizationId).then(setOrganization);
    usersService.listByOrganizationId(organizationId).then(setMembers);
  }, [organizationId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-2xl">
        {organization ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="text-sm font-medium">
                    {initials(organization.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle>{organization.name}</SheetTitle>
                  <SheetDescription>
                    {t("membersCount", { count: organization.memberCount })}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">{t("regionColumn")}</p>
                  <p className="text-foreground">
                    {organization.region.length > 0
                      ? organization.region.join(", ")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t("statusColumn")}</p>
                  <Badge
                    variant={organization.isActive ? "default" : "outline"}
                    className={
                      organization.isActive
                        ? "bg-badge-success text-badge-success-foreground border-transparent"
                        : undefined
                    }
                  >
                    {t(organization.isActive ? "statusActive" : "statusInactive")}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-sm font-medium">
                    {t("membersHeading")}
                  </p>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link href="/settings/users">
                      <Users2 className="size-3.5" />
                      {t("manageInUsers")}
                    </Link>
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("nameColumn")}</TableHead>
                      <TableHead>{t("membersRoleColumn")}</TableHead>
                      <TableHead>{t("statusColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members === null || members.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground py-6 text-center text-sm"
                        >
                          {members === null ? "…" : t("noMembers")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <p className="text-foreground text-sm font-medium">
                              {member.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {member.email}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{member.role.name}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {member.status}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function OrganizationsSettingsPage() {
  const t = useTranslations("app.settings.organizations");
  const tSectors = useTranslations("app.settings.organization.sectors");
  const { session } = useAuth();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (session?.role.key === "system_admin") {
      router.replace("/system-admin/organizations");
    } else {
      organizationsService.listAll().then(setOrganizations);
    }
  }, [session, router]);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  return (
    <CrossEntityGuard>
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nameColumn")}</TableHead>
                  <TableHead>{t("regionColumn")}</TableHead>
                  <TableHead>{t("sectorColumn")}</TableHead>
                  <TableHead>{t("membersColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations === null ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <div className="bg-muted h-5 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : organizations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <Building2 className="size-5" />
                        </div>
                        <p>{t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((organization) => (
                    <TableRow
                      key={organization.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => openDetail(organization.id)}
                    >
                      <TableCell className="text-foreground font-medium">
                        {organization.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.region.join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.sector ? tSectors(organization.sector) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.memberCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={organization.isActive ? "default" : "outline"}
                          className={
                            organization.isActive
                              ? "bg-badge-success text-badge-success-foreground border-transparent"
                              : undefined
                          }
                        >
                          {t(organization.isActive ? "statusActive" : "statusInactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("viewOrganization")}
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail(organization.id);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <OrganizationDetailSheet
          organizationId={detailId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
