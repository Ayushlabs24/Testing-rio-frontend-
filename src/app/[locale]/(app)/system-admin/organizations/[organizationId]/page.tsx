"use client";

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Users2,
  XCircle,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Search,
  Filter,
  RefreshCw,
  UserX,
  Shield,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useState, useMemo, useCallback } from "react";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import { formatDate } from "@/lib/format-date";
import { AutoTranslate } from "@/components/common/auto-translate";
import { PageContainer } from "@/components/common/page-container";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { geographyService } from "@/services/geography/geography.service";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";
import { ApproveOrganizationDialog } from "../_components/approve-organization-dialog";
import { DeactivateOrganizationDialog } from "../_components/deactivate-organization-dialog";
import { ReactivateOrganizationDialog } from "../_components/reactivate-organization-dialog";
import { AssignNgoAdminDialog } from "../_components/assign-ngo-admin-dialog";
import { InviteUserDialog } from "../_components/invite-user-dialog";
import { ChangeRoleDialog } from "../_components/change-role-dialog";
import { ToggleUserStatusDialog } from "../_components/toggle-user-status-dialog";
import { OrgStudiesTab } from "../_components/org-studies-tab";
import { OrgSurveysTab } from "../_components/org-surveys-tab";
import { OrgReportsTab } from "../_components/org-reports-tab";
import { OrgArchiveTab } from "../_components/org-archive-tab";
import { OrgAuditHistoryTab } from "../_components/org-audit-history-tab";

const USERS_PAGE_SIZE = 10;

export default function SystemAdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = use(params);
  const t = useTranslations("systemAdmin.detail");
  const locale = useLocale() as AppLocale;
  const tOrgs = useTranslations("systemAdmin.organizations");
  const tNgo = useTranslations("systemAdmin.ngoAdmin");
  const tUsers = useTranslations("systemAdmin.users");
  const tRoleNames = useTranslations("app.settings.roles.roleNames");
  // Client-reported gap (2026-09-10) — this page showed the backend's raw
  // English role name (e.g. "NGO Admin") instead of resolving it through the
  // same `app.settings.roles.roleNames` dictionary every other role display
  // in the app already uses (see app-topbar.tsx). `key` is missing for a
  // custom/unrecognised role, hence the fallback to the raw name.
  const roleLabel = useCallback(
    (key: string, fallbackName: string) =>
      tRoleNames.has(key) ? tRoleNames(key) : fallbackName,
    [tRoleNames],
  );

  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Filters for Users Tab
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [usersPage, setUsersPage] = useState(1);

  // RIO-FR-010: self-registration sets `regionId` (the real KSA Geographic
  // Reference), never the legacy free-text `region` array — resolve it by
  // id or a pending org's region silently shows blank.
  const [regionNameById, setRegionNameById] = useState<
    Map<string, { name: string; nameAr: string | null }>
  >(new Map());
  useEffect(() => {
    geographyService
      .listRegions()
      .then((rows) => setRegionNameById(new Map(rows.map((r) => [r.id, r]))))
      .catch(() => setRegionNameById(new Map()));
  }, []);

  // RIO-RBAC-002 governance email (client-confirmed): System Reviewer holds
  // View + Approve on Users & Organizations, System Admin holds Create/Edit
  // (write) — not Approve. Same split as the org list page.
  const canEdit = usePermission("entityTeam", "write");
  const canApprove = usePermission("entityTeam", "approve");

  // Dialog states
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [assignAdminDialogOpen, setAssignAdminDialogOpen] = useState(false);
  const [inviteUserDialogOpen, setInviteUserDialogOpen] = useState(false);

  const [changeRoleUser, setChangeRoleUser] = useState<OrgUser | null>(null);
  const [toggleStatusUser, setToggleStatusUser] = useState<OrgUser | null>(null);
  const [targetStatus, setTargetStatus] = useState<"active" | "disabled">("disabled");
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  const loadOrganizationData = useCallback(() => {
    Promise.all([
      organizationsService.getById(organizationId),
      usersService.listForOrg(organizationId).catch(() => []),
    ])
      .then(([orgData, usersData]) => {
        setOrganization(orgData);
        setOrgUsers(usersData);
        setLoading(false);
      })
      .catch(() => {
        setOrganization(null);
        setOrgUsers([]);
        setLoading(false);
      });
  }, [organizationId]);

  useEffect(() => {
    loadOrganizationData();
  }, [loadOrganizationData]);

  // Unique roles for filter dropdown
  const availableRoles = useMemo(() => {
    const map = new Map<string, string>();
    orgUsers.forEach((u) => map.set(u.role.key, u.role.name));
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [orgUsers]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return orgUsers.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === "all" ||
        user.role.key === roleFilter ||
        user.role.id === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [orgUsers, searchQuery, roleFilter, statusFilter]);

  const usersPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const usersCurrentPage = Math.min(usersPage, usersPageCount);
  const pagedUsers = filteredUsers.slice(
    (usersCurrentPage - 1) * USERS_PAGE_SIZE,
    usersCurrentPage * USERS_PAGE_SIZE,
  );

  const handleResendInvite = async (userId: string) => {
    setResendingInviteId(userId);
    try {
      await usersService.resendInviteForOrg(organizationId, userId);
      loadOrganizationData();
    } catch {
      // Handled cleanly
    } finally {
      setResendingInviteId(null);
    }
  };

  if (loading) {
    return (
      <CrossEntityGuard>
        <PageContainer>
          <div className="bg-muted h-32 w-full animate-pulse rounded-lg" />
        </PageContainer>
      </CrossEntityGuard>
    );
  }

  if (!organization) {
    return (
      <CrossEntityGuard>
        <PageContainer>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="text-muted-foreground/40 size-12" />
            <h2 className="mt-4 text-lg font-semibold">{tOrgs("noResults")}</h2>
            <Button variant="outline" className="mt-4 gap-2" asChild>
              <Link href="/system-admin/organizations">
                <ArrowLeft className="size-4" />
                {t("backToOrganizations")}
              </Link>
            </Button>
          </div>
        </PageContainer>
      </CrossEntityGuard>
    );
  }

  const currentNgoAdmin = orgUsers.find((u) => u.role.key === "ngo_admin") ?? null;
  const ngoAdminName = currentNgoAdmin?.name ?? organization.ngoAdminName;
  const ngoAdminEmail = currentNgoAdmin?.email ?? organization.ngoAdminEmail;
  const hasNgoAdmin = !!(ngoAdminName || currentNgoAdmin);

  return (
    <CrossEntityGuard>
      <PageContainer>
        {/* Back Link */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1.5"
            asChild
          >
            <Link href="/system-admin/organizations">
              <ArrowLeft className="size-4" />
              {t("backToOrganizations")}
            </Link>
          </Button>
        </div>

        {/* Organization Header */}
        <div className="border-border bg-card mb-6 flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-foreground text-2xl font-bold">
                <AutoTranslate text={organization.name} />
              </h1>
              <Badge
                variant={organization.isActive ? "default" : "outline"}
                className={
                  organization.isActive
                    ? "bg-badge-success text-badge-success-foreground border-transparent"
                    : undefined
                }
              >
                {tOrgs(organization.isActive ? "active" : "inactive")}
              </Badge>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
              <span>
                {tOrgs("table.code")}:{" "}
                <span className="font-mono font-medium">
                  {organization.registrationNumber ?? "—"}
                </span>
              </span>
              <span>•</span>
              <span>
                {tOrgs("table.region")}:{" "}
                {organization.region.length > 0
                  ? organization.region.join(", ")
                  : (organization.regionId &&
                      (() => {
                        const region = regionNameById.get(organization.regionId!);
                        return region ? localizedName(region, locale) : null;
                      })()) ||
                    "—"}
              </span>
              <span>•</span>
              <span>
                {tOrgs("table.createdDate")}: {formatDate(organization.createdAt, locale)}
              </span>
            </div>
          </div>

          <div>
            {organization.isActive
              ? canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => setDeactivateDialogOpen(true)}
                    className="gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                  >
                    <XCircle className="size-4" />
                    {t("overview.deactivateButton")}
                  </Button>
                )
              : !organization.approvedAt
                ? // RIO-FR-010 (client-confirmed): a never-approved
                  // self-registration needs Approve, not Reactivate — the two
                  // are different actions (approve also issues the entity's
                  // first real credentials). RIO-RBAC-002 governance email:
                  // Approve is System Reviewer's action, not System Admin's.
                  canApprove && (
                    <Button
                      variant="outline"
                      onClick={() => setApproveDialogOpen(true)}
                      className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                    >
                      <ShieldCheck className="size-4" />
                      {t("overview.approveButton")}
                    </Button>
                  )
                : canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => setReactivateDialogOpen(true)}
                      className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                    >
                      <CheckCircle2 className="size-4" />
                      {t("overview.reactivateButton")}
                    </Button>
                  )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/60 mb-6 flex h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
            <TabsTrigger value="users">{t("tabs.users")}</TabsTrigger>
            <TabsTrigger value="studies">{t("tabs.studies")}</TabsTrigger>
            <TabsTrigger value="surveys">{t("tabs.surveys")}</TabsTrigger>
            <TabsTrigger value="reports">{t("tabs.reports")}</TabsTrigger>
            <TabsTrigger value="archive">{t("tabs.archive")}</TabsTrigger>
            <TabsTrigger value="auditHistory">{t("tabs.auditHistory")}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("overview.infoCardTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="border-border/50 border-b pb-3">
                    <p className="text-muted-foreground text-xs">
                      {t("overview.contactEmail")}
                    </p>
                    <p className="text-foreground font-medium">
                      {organization.email || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                        <Users2 className="size-4" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("overview.userCount")}
                        </p>
                        <p className="text-foreground text-lg font-semibold">
                          {organization.memberCount}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                        <ClipboardCheck className="size-4" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("overview.studyCount")}
                        </p>
                        <p className="text-foreground text-lg font-semibold">
                          {organization.studyCount ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                        <BarChart3 className="size-4" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("overview.surveyCount")}
                        </p>
                        <p className="text-foreground text-lg font-semibold">
                          {organization.surveyCount ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
                        <FileText className="size-4" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">
                          {t("overview.reportCount")}
                        </p>
                        <p className="text-foreground text-lg font-semibold">
                          {organization.reportCount ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* NGO Administration Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-semibold">
                    {tNgo("cardTitle")}
                  </CardTitle>
                  <ShieldCheck className="text-primary size-4" />
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {tNgo("currentAdmin")}
                    </p>
                    {hasNgoAdmin ? (
                      <div className="mt-1">
                        <p className="text-foreground font-semibold">
                          {ngoAdminName ? <AutoTranslate text={ngoAdminName} /> : null}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {ngoAdminEmail ?? "—"}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground mt-1">
                        {tNgo("notAssigned")}
                      </Badge>
                    )}
                  </div>

                  {currentNgoAdmin ? (
                    <div className="border-border/50 flex flex-col gap-2 border-t pt-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground">{tNgo("status")}:</span>
                        <Badge variant="outline">
                          {tUsers(`statusBadges.${currentNgoAdmin.status}` as never)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="text-muted-foreground">
                          {tNgo("assignedDate")}:
                        </span>
                        <span className="font-mono">
                          {formatDate(currentNgoAdmin.createdAt, locale)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {canEdit ? (
                    <div className="border-border/50 border-t pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAssignAdminDialogOpen(true)}
                        disabled={!organization.isActive}
                        className="w-full gap-2"
                      >
                        <UserCheck className="size-4" />
                        {hasNgoAdmin ? tNgo("changeButton") : tNgo("assignButton")}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    {t("overview.statusCardTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {t("overview.currentStatus")}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant={organization.isActive ? "default" : "outline"}
                        className={
                          organization.isActive
                            ? "bg-badge-success text-badge-success-foreground border-transparent"
                            : undefined
                        }
                      >
                        {tOrgs(organization.isActive ? "active" : "inactive")}
                      </Badge>
                    </div>
                  </div>

                  {!organization.isActive && organization.deactivationReason ? (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
                      <p className="font-semibold text-amber-900 dark:text-amber-200">
                        {t("overview.deactivationReasonLabel")}
                      </p>
                      <p className="mt-1 text-amber-800 dark:text-amber-300">
                        {organization.deactivationReason}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {tUsers("title")} ({orgUsers.length})
                  </CardTitle>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    onClick={() => setInviteUserDialogOpen(true)}
                    disabled={!organization.isActive}
                    className="gap-2"
                  >
                    <UserPlus className="size-4" />
                    {tUsers("inviteButton")}
                  </Button>
                ) : null}
              </CardHeader>

              {/* Filters Bar */}
              <div className="flex flex-col gap-3 px-6 pb-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                  <Input
                    placeholder={tUsers("searchPlaceholder")}
                    aria-label={tUsers("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setUsersPage(1);
                    }}
                    className="pl-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={roleFilter}
                    onValueChange={(val) => {
                      setRoleFilter(val);
                      setUsersPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[160px] text-xs">
                      <Filter className="text-muted-foreground mr-1.5 size-3.5" />
                      <SelectValue placeholder={tUsers("filterRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tUsers("allRoles")}</SelectItem>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.key} value={r.key}>
                          {roleLabel(r.key, r.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val);
                      setUsersPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[150px] text-xs">
                      <SelectValue placeholder={tUsers("filterStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tUsers("allStatuses")}</SelectItem>
                      <SelectItem value="active">
                        {tUsers("statusBadges.active")}
                      </SelectItem>
                      <SelectItem value="invited">
                        {tUsers("statusBadges.invited")}
                      </SelectItem>
                      <SelectItem value="disabled">
                        {tUsers("statusBadges.disabled")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* User Table */}
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tUsers("columns.name")}</TableHead>
                      <TableHead>{tUsers("columns.email")}</TableHead>
                      <TableHead>{tUsers("columns.role")}</TableHead>
                      <TableHead>{tUsers("columns.accountStatus")}</TableHead>
                      <TableHead>{tUsers("columns.createdDate")}</TableHead>
                      <TableHead className="text-right">
                        {tUsers("columns.actions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-muted-foreground h-24 text-center"
                        >
                          {tUsers("noFilterMatches")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedUsers.map((user) => {
                        const isNgoAdmin = user.role.key === "ngo_admin";
                        const isDisabled = user.status === "disabled";

                        return (
                          <TableRow key={user.id}>
                            <TableCell className="text-foreground font-medium">
                              <div className="flex items-center gap-2">
                                <span>
                                  <AutoTranslate text={user.name} />
                                </span>
                                {isNgoAdmin ? (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                    {tNgo("usersTab.badgeAdmin")}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {user.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {roleLabel(user.role.key, user.role.name)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  isDisabled
                                    ? "destructive"
                                    : user.status === "active"
                                      ? "default"
                                      : "secondary"
                                }
                                className="capitalize"
                              >
                                {tUsers(`statusBadges.${user.status}` as never)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">
                              {formatDate(user.createdAt, locale)}
                            </TableCell>
                            <TableCell className="text-right">
                              {canEdit ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Change Role */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setChangeRoleUser(user)}
                                    disabled={!organization.isActive}
                                    className="size-8 p-0"
                                    title={tUsers("actions.changeRole")}
                                  >
                                    <Shield className="text-muted-foreground size-3.5" />
                                  </Button>

                                  {/* Resend Invite (if status === 'invited') */}
                                  {user.status === "invited" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleResendInvite(user.id)}
                                      disabled={
                                        resendingInviteId === user.id ||
                                        !organization.isActive
                                      }
                                      className="size-8 p-0"
                                      title={tUsers("actions.resendInvite")}
                                    >
                                      <RefreshCw
                                        className={`text-muted-foreground size-3.5 ${resendingInviteId === user.id ? "animate-spin" : ""}`}
                                      />
                                    </Button>
                                  ) : null}

                                  {/* Enable / Disable User */}
                                  {isDisabled ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setToggleStatusUser(user);
                                        setTargetStatus("active");
                                      }}
                                      disabled={!organization.isActive}
                                      className="size-8 p-0 text-emerald-600 hover:text-emerald-700"
                                      title={tUsers("actions.enableUser")}
                                    >
                                      <UserCheck className="size-3.5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setToggleStatusUser(user);
                                        setTargetStatus("disabled");
                                      }}
                                      className="text-destructive hover:text-destructive size-8 p-0"
                                      title={tUsers("actions.disableUser")}
                                    >
                                      <UserX className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {filteredUsers.length > 0 ? (
                  <div className="border-border flex justify-end border-t px-4 py-3">
                    <Pagination
                      page={usersCurrentPage}
                      pageCount={usersPageCount}
                      onPageChange={setUsersPage}
                      previousLabel={tUsers("pagination.previous")}
                      nextLabel={tUsers("pagination.next")}
                      pageLabel={(p, count) =>
                        tUsers("pagination.label", { page: p, count })
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Real Read-Only Tabs */}
          <TabsContent value="studies">
            <OrgStudiesTab organizationId={organization.id} />
          </TabsContent>

          <TabsContent value="surveys">
            <OrgSurveysTab organizationId={organization.id} />
          </TabsContent>

          <TabsContent value="reports">
            <OrgReportsTab organizationId={organization.id} />
          </TabsContent>

          <TabsContent value="archive">
            <OrgArchiveTab organizationId={organization.id} />
          </TabsContent>

          <TabsContent value="auditHistory">
            <OrgAuditHistoryTab organizationId={organization.id} />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <AssignNgoAdminDialog
          organizationId={organization.id}
          organizationName={organization.name}
          hasCurrentAdmin={hasNgoAdmin}
          open={assignAdminDialogOpen}
          onOpenChange={setAssignAdminDialogOpen}
          onAssigned={loadOrganizationData}
        />
        <InviteUserDialog
          organizationId={organization.id}
          organizationName={organization.name}
          open={inviteUserDialogOpen}
          onOpenChange={setInviteUserDialogOpen}
          onInvited={loadOrganizationData}
        />
        <ChangeRoleDialog
          organizationId={organization.id}
          user={changeRoleUser}
          open={!!changeRoleUser}
          onOpenChange={(open) => !open && setChangeRoleUser(null)}
          onUpdated={loadOrganizationData}
        />
        <ToggleUserStatusDialog
          organizationId={organization.id}
          isOrgActive={organization.isActive}
          user={toggleStatusUser}
          targetStatus={targetStatus}
          open={!!toggleStatusUser}
          onOpenChange={(open) => !open && setToggleStatusUser(null)}
          onUpdated={loadOrganizationData}
        />
        <DeactivateOrganizationDialog
          organization={organization}
          open={deactivateDialogOpen}
          onOpenChange={setDeactivateDialogOpen}
          onUpdated={loadOrganizationData}
        />
        <ReactivateOrganizationDialog
          organization={organization}
          open={reactivateDialogOpen}
          onOpenChange={setReactivateDialogOpen}
          onUpdated={loadOrganizationData}
        />
        <ApproveOrganizationDialog
          organization={organization}
          open={approveDialogOpen}
          onOpenChange={setApproveDialogOpen}
          onUpdated={loadOrganizationData}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
