"use client";

import {
  Building2,
  CheckCircle2,
  Eye,
  PlusCircle,
  Search,
  ShieldCheck,
  XCircle,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useMemo } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SYSTEM_ADMIN_ORGANIZATIONS_PAGE_SIZE } from "@/config/pagination";
import { geographyService } from "@/services/geography/geography.service";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { ApproveOrganizationDialog } from "./_components/approve-organization-dialog";
import { CreateOrganizationDialog } from "./_components/create-organization-dialog";
import { DeactivateOrganizationDialog } from "./_components/deactivate-organization-dialog";
import { ReactivateOrganizationDialog } from "./_components/reactivate-organization-dialog";

export default function SystemAdminOrganizationsPage() {
  const t = useTranslations("systemAdmin.organizations");
  const router = useRouter();

  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive" | "pending"
  >("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deactivateOrg, setDeactivateOrg] = useState<OrganizationSummary | null>(null);
  const [reactivateOrg, setReactivateOrg] = useState<OrganizationSummary | null>(null);
  const [approveOrg, setApproveOrg] = useState<OrganizationSummary | null>(null);

  // RIO-FR-010: self-registration sets `regionId` (the real KSA Geographic
  // Reference), never the legacy free-text `region` array — so an org
  // created that way needs its region resolved by id, not just read off
  // `org.region`, or it silently shows blank.
  const [regionNameById, setRegionNameById] = useState<Map<string, string>>(new Map());

  const fetchOrganizations = () => {
    organizationsService
      .listAll()
      .then(setOrganizations)
      .catch(() => setOrganizations([]));
  };

  useEffect(() => {
    fetchOrganizations();
    geographyService
      .listRegions()
      .then((rows) => setRegionNameById(new Map(rows.map((r) => [r.id, r.name]))))
      .catch(() => setRegionNameById(new Map()));
  }, []);

  const displayRegion = useCallback(
    (org: OrganizationSummary): string => {
      if (org.region.length > 0) return org.region.join(", ");
      if (org.regionId) return regionNameById.get(org.regionId) ?? "—";
      return "—";
    },
    [regionNameById],
  );

  const regions = useMemo(() => {
    if (!organizations) return [];
    const set = new Set<string>();
    for (const org of organizations) {
      for (const r of org.region) {
        if (r.trim()) set.add(r.trim());
      }
      if (org.region.length === 0 && org.regionId) {
        const name = regionNameById.get(org.regionId);
        if (name) set.add(name);
      }
    }
    return Array.from(set).sort();
  }, [organizations, regionNameById]);

  const filteredOrganizations = useMemo(() => {
    if (!organizations) return [];
    return organizations.filter((org) => {
      // Search
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchesName = org.name.toLowerCase().includes(query);
        const matchesCode = (org.registrationNumber ?? "").toLowerCase().includes(query);
        const matchesAdmin =
          (org.ngoAdminName ?? "").toLowerCase().includes(query) ||
          (org.ngoAdminEmail ?? "").toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesAdmin) return false;
      }
      // Status — "pending" (never approved) is distinct from "inactive"
      // (was approved, later suspended) — RIO-FR-010.
      if (statusFilter === "active" && !org.isActive) return false;
      if (statusFilter === "inactive" && (org.isActive || !org.approvedAt)) return false;
      if (statusFilter === "pending" && org.approvedAt) return false;

      // Region
      if (regionFilter !== "all") {
        if (displayRegion(org) !== regionFilter && !org.region.includes(regionFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [organizations, searchQuery, statusFilter, regionFilter, displayRegion]);

  const hasActiveFilters =
    searchQuery !== "" || statusFilter !== "all" || regionFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setRegionFilter("all");
    setPage(1);
  };

  const pageCount = Math.max(
    1,
    Math.ceil(filteredOrganizations.length / SYSTEM_ADMIN_ORGANIZATIONS_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const pagedOrganizations = filteredOrganizations.slice(
    (currentPage - 1) * SYSTEM_ADMIN_ORGANIZATIONS_PAGE_SIZE,
    currentPage * SYSTEM_ADMIN_ORGANIZATIONS_PAGE_SIZE,
  );

  return (
    <CrossEntityGuard>
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <PlusCircle className="size-4" />
              {t("createButton")}
            </Button>
          }
        />

        {/* Filters bar */}
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(val: "all" | "active" | "inactive" | "pending") => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="pending">{t("pendingApproval")}</SelectItem>
                <SelectItem value="inactive">{t("inactive")}</SelectItem>
              </SelectContent>
            </Select>

            {regions.length > 0 ? (
              <Select
                value={regionFilter}
                onValueChange={(v) => {
                  setRegionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("allRegions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allRegions")}</SelectItem>
                  {regions.map((reg) => (
                    <SelectItem key={reg} value={reg}>
                      {reg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground gap-1"
              >
                <X className="size-4" />
                {t("clearFilters")}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.code")}</TableHead>
                  <TableHead>{t("table.region")}</TableHead>
                  <TableHead>{t("table.ngoAdmin")}</TableHead>
                  <TableHead>{t("table.userCount")}</TableHead>
                  <TableHead>{t("table.studyCount")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.createdDate")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations === null ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}>
                        <div className="bg-muted h-6 w-full animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Building2 className="text-muted-foreground/50 size-8" />
                        <p>{t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedOrganizations.map((org) => (
                    <TableRow
                      key={org.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/system-admin/organizations/${org.id}`)}
                    >
                      <TableCell className="text-foreground font-medium">
                        {org.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {org.registrationNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {displayRegion(org)}
                      </TableCell>
                      <TableCell>
                        {org.ngoAdminName ? (
                          <div>
                            <p className="text-foreground text-xs font-medium">
                              {org.ngoAdminName}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {org.ngoAdminEmail}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.memberCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.studyCount ?? 0}
                      </TableCell>
                      <TableCell>
                        {org.isActive ? (
                          <Badge className="bg-badge-success text-badge-success-foreground border-transparent">
                            {t("active")}
                          </Badge>
                        ) : !org.approvedAt ? (
                          <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            {t("pendingApproval")}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t("inactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title={t("viewDetails")}
                          >
                            <Link href={`/system-admin/organizations/${org.id}`}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          {org.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeactivateOrg(org)}
                              title={t("inactive")}
                              className="text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                            >
                              <XCircle className="size-4" />
                            </Button>
                          ) : !org.approvedAt ? (
                            // RIO-FR-010 (client-confirmed): a never-approved
                            // self-registration needs Approve, not Reactivate
                            // — the two are different actions (approve also
                            // issues the entity's first real credentials).
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setApproveOrg(org)}
                              title={t("pendingApproval")}
                              className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                            >
                              <ShieldCheck className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReactivateOrg(org)}
                              title={t("active")}
                              className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                          )}
                        </div>
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

        {/* Dialogs */}
        <CreateOrganizationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreated={fetchOrganizations}
        />
        <DeactivateOrganizationDialog
          organization={deactivateOrg}
          open={!!deactivateOrg}
          onOpenChange={(open) => !open && setDeactivateOrg(null)}
          onUpdated={fetchOrganizations}
        />
        <ReactivateOrganizationDialog
          organization={reactivateOrg}
          open={!!reactivateOrg}
          onOpenChange={(open) => !open && setReactivateOrg(null)}
          onUpdated={fetchOrganizations}
        />
        <ApproveOrganizationDialog
          organization={approveOrg}
          open={!!approveOrg}
          onOpenChange={(open) => !open && setApproveOrg(null)}
          onUpdated={fetchOrganizations}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
