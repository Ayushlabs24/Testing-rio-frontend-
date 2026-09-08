"use client";

import { Building2, Eye, Users2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { useAuth } from "@/components/providers/auth-provider";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ORGANIZATIONS_PAGE_SIZE } from "@/config/pagination";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";

const ALL = "all";

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
                  <SheetTitle>
                    <AutoTranslate text={organization.name} />
                  </SheetTitle>
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
  // Region/Sector filters + pagination (Aug 14): this list has no upper
  // bound (every org on the platform), so a System Reviewer/Center
  // Supervisor scanning it needs both a way to narrow it down and a way to
  // page through it without one giant unbroken table.
  const [regionFilter, setRegionFilter] = useState<string>(ALL);
  const [sectorFilter, setSectorFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  useEffect(() => {
    // RIO-RBAC-002 governance email (client-confirmed): System Reviewer now
    // holds View (platform-wide) + Approve on Users & Organizations, same as
    // System Admin's own reason for redirecting here — this page has no
    // regionId fallback (self-registered orgs show a blank region — see
    // /system-admin/organizations's displayRegion) and no Approve action at
    // all, so neither role should land on it.
    if (session?.role.key === "system_admin" || session?.role.key === "system_reviewer") {
      router.replace("/system-admin/organizations");
    } else {
      organizationsService.listAll().then(setOrganizations);
    }
  }, [session, router]);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  // Derived from whatever's actually loaded — region and sector are both
  // free-text (region an array per org, sector a live Methodology
  // Configuration domain name), so there's no fixed enum to filter against;
  // the option list is exactly what's really in use right now.
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    for (const org of organizations ?? []) {
      for (const r of org.region) set.add(r);
    }
    return Array.from(set).sort();
  }, [organizations]);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const org of organizations ?? []) {
      if (org.sector) set.add(org.sector);
    }
    return Array.from(set).sort();
  }, [organizations]);

  const filteredOrganizations = useMemo(() => {
    return (organizations ?? []).filter(
      (org) =>
        (regionFilter === ALL || org.region.includes(regionFilter)) &&
        (sectorFilter === ALL || org.sector === sectorFilter),
    );
  }, [organizations, regionFilter, sectorFilter]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredOrganizations.length / ORGANIZATIONS_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const pagedOrganizations = filteredOrganizations.slice(
    (currentPage - 1) * ORGANIZATIONS_PAGE_SIZE,
    currentPage * ORGANIZATIONS_PAGE_SIZE,
  );

  return (
    <CrossEntityGuard>
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Select
                value={regionFilter}
                onValueChange={(v) => {
                  setRegionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-48"
                  aria-label={t("filterRegionLabel")}
                >
                  <SelectValue placeholder={t("filterRegionLabel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterRegionAll")}</SelectItem>
                  {availableRegions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={sectorFilter}
                onValueChange={(v) => {
                  setSectorFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-48"
                  aria-label={t("filterSectorLabel")}
                >
                  <SelectValue placeholder={t("filterSectorLabel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterSectorAll")}</SelectItem>
                  {availableSectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {tSectors.has(sector as never) ? tSectors(sector as never) : sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                ) : filteredOrganizations.length === 0 ? (
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
                  pagedOrganizations.map((organization) => (
                    <TableRow
                      key={organization.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => openDetail(organization.id)}
                    >
                      <TableCell className="text-foreground font-medium">
                        <AutoTranslate text={organization.name} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.region.join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.sector
                          ? tSectors.has(organization.sector as never)
                            ? tSectors(organization.sector as never)
                            : organization.sector
                          : "—"}
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

            {filteredOrganizations.length > 0 ? (
              <div className="border-border border-t px-4 py-3">
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                />
              </div>
            ) : null}
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
