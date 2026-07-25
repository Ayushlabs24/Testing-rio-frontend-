"use client";

import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  PlusCircle,
  ScrollText,
  Users2,
  XCircle,
  BarChart3,
  ArrowRight,
  ClipboardEdit,
  Layers,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { studiesService } from "@/services/studies/studies.service";
import type { PlatformStudyStats } from "@/services/studies/studies.types";
import { CreateOrganizationDialog } from "../organizations/_components/create-organization-dialog";
import { GovernanceWidget } from "../_components/governance-widget";

interface PreviewUser {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  roleName?: string;
  status: string;
  orgName?: string;
}

interface PreviewSurvey {
  id: string;
  title: string;
  orgName: string | null;
  studyTitle: string | null;
  status: string;
  responseCount: number;
}

interface PreviewStudy {
  id: string;
  title: string;
  orgName?: string;
  villages: string[];
  cycleNumber: number;
  createdAt: string;
}

export default function SystemAdminDashboardPage() {
  const t = useTranslations("systemAdmin.dashboard");
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [studyStats, setStudyStats] = useState<PlatformStudyStats | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [recentUsers, setRecentUsers] = useState<PreviewUser[]>([]);
  const [recentSurveys, setRecentSurveys] = useState<PreviewSurvey[]>([]);
  const [recentStudies, setRecentStudies] = useState<PreviewStudy[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(true);

  const loadDashboardData = () => {
    organizationsService
      .listAll()
      .then(setOrganizations)
      .catch(() => undefined);
    studiesService
      .getPlatformStats()
      .then(setStudyStats)
      .catch(() => undefined);

    Promise.all([
      apiClient.get<PreviewUser[]>("/users", { params: { limit: "5" } }).catch(() => []),
      apiClient
        .get<{ items: PreviewSurvey[] }>("/surveys", { params: { limit: "5" } })
        .catch(() => ({ items: [] })),
      apiClient
        .get<{ items: PreviewStudy[] }>(endpoints.studies.list, {
          params: { limit: "5" },
        })
        .catch(() => ({ items: [] })),
    ]).then(([usersRes, surveysRes, studiesRes]) => {
      setRecentUsers(Array.isArray(usersRes) ? usersRes.slice(0, 5) : []);
      setRecentSurveys(surveysRes.items ? surveysRes.items.slice(0, 5) : []);
      setRecentStudies(studiesRes.items ? studiesRes.items.slice(0, 5) : []);
      setLoadingPreviews(false);
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const activeOrgsCount = organizations?.filter((o) => o.isActive).length ?? 0;
  const inactiveOrgsCount = organizations?.filter((o) => !o.isActive).length ?? 0;
  const totalUsersCount =
    organizations?.reduce((sum, o) => sum + (o.memberCount ?? 0), 0) ?? 0;
  const totalStudiesCount =
    organizations?.reduce((sum, o) => sum + (o.studyCount ?? 0), 0) ??
    studyStats?.activeStudies ??
    0;
  const totalSurveysCount =
    organizations?.reduce((sum, o) => sum + (o.surveyCount ?? 0), 0) ?? 0;
  const publishedReportsCount =
    organizations?.reduce((sum, o) => sum + (o.reportCount ?? 0), 0) ??
    studyStats?.reportsGenerated ??
    0;

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <PageHeader title={t("title")} description={t("description")} />
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 text-xs">
              <PlusCircle className="size-4" />
              {t("createOrganization")}
            </Button>
          </div>

          {/* Summary Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("totalOrganizations")}
              value={organizations?.length ?? 0}
              icon={Building2}
            />
            <StatCard
              label={t("activeOrganizations")}
              value={activeOrgsCount}
              icon={CheckCircle2}
            />
            <StatCard
              label={t("inactiveOrganizations")}
              value={inactiveOrgsCount}
              icon={XCircle}
            />
            <StatCard label={t("totalUsers")} value={totalUsersCount} icon={Users2} />
            <StatCard
              label={t("totalStudies")}
              value={totalStudiesCount}
              icon={ClipboardCheck}
            />
            <StatCard
              label={t("totalSurveys")}
              value={totalSurveysCount}
              icon={BarChart3}
            />
            <StatCard
              label={t("publishedReports")}
              value={publishedReportsCount}
              icon={FileText}
            />
            {/* Reviewer Alerts StatCard commented out per user request */}
            {/* <StatCard
              label={t("pendingReviewerAlerts")}
              value={studyStats?.pendingReviews ?? 0}
              icon={AlarmClock}
            /> */}
          </div>

          {/* Workspace Shortcuts Navigation Grid */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="text-primary size-4" />
                {t("shortcuts")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Button
                variant="outline"
                asChild
                className="hover:border-primary/50 flex h-auto flex-col gap-1.5 px-2 py-3 text-xs"
              >
                <Link href="/system-admin/organizations">
                  <Building2 className="text-primary size-5" />
                  <span>{t("viewOrganizations")}</span>
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                className="hover:border-primary/50 flex h-auto flex-col gap-1.5 px-2 py-3 text-xs"
              >
                <Link href="/settings/users">
                  <Users2 className="size-5 text-blue-500" />
                  <span>{t("manageUsers")}</span>
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                className="hover:border-primary/50 flex h-auto flex-col gap-1.5 px-2 py-3 text-xs"
              >
                <Link href="/system-admin/studies">
                  <ClipboardCheck className="size-5 text-emerald-500" />
                  <span>{t("viewStudies")}</span>
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                className="hover:border-primary/50 flex h-auto flex-col gap-1.5 px-2 py-3 text-xs"
              >
                <Link href="/system-admin/surveys">
                  <ClipboardEdit className="size-5 text-purple-500" />
                  <span>{t("viewSurveys")}</span>
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                className="hover:border-primary/50 flex h-auto flex-col gap-1.5 px-2 py-3 text-xs"
              >
                <Link href="/system-admin/reports">
                  <FileText className="size-5 text-amber-500" />
                  <span>{t("viewReports")}</span>
                </Link>
              </Button>

              {/* Archive shortcut commented out per user request */}
              {/* <Button variant="outline" asChild className="flex flex-col h-auto py-3 px-2 text-xs gap-1.5 hover:border-primary/50">
                <Link href="/system-admin/archive">
                  <Archive className="size-5 text-cyan-500" />
                  <span>{t("viewArchive")}</span>
                </Link>
              </Button> */}

              <Button
                variant="outline"
                asChild
                className="hover:border-primary/50 flex h-auto flex-col gap-1.5 px-2 py-3 text-xs"
              >
                <Link href="/system-admin/audit-log">
                  <ScrollText className="size-5 text-rose-500" />
                  <span>{t("viewAuditLog")}</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Cards Grid: Recent Users, Surveys, and Studies */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Card 1: Recent Users */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="border-border border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Users2 className="size-4 text-blue-500" />
                    {t("recentUsers")}
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t("top5Badge")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4">
                {loadingPreviews ? (
                  <div className="flex h-36 items-center justify-center">
                    <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : recentUsers.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-xs italic">
                    {t("noUsers")}
                  </p>
                ) : (
                  <div className="space-y-3 text-xs">
                    {recentUsers.map((u) => (
                      <div
                        key={u.id}
                        className="border-border/50 flex items-center justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0"
                      >
                        <div className="truncate">
                          <p className="text-foreground truncate font-medium">{u.name}</p>
                          <p className="text-muted-foreground truncate font-mono text-[11px]">
                            {u.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            u.status === "active"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 capitalize dark:text-emerald-400"
                              : "text-[10px] capitalize"
                          }
                        >
                          {u.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="border-border bg-muted/20 border-t p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-primary w-full justify-between text-xs font-medium"
                >
                  <Link href="/settings/users">
                    <span>{t("viewAllUsers")}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>

            {/* Card 2: Recent Surveys */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="border-border border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardEdit className="size-4 text-purple-500" />
                    {t("recentSurveys")}
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t("top5Badge")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4">
                {loadingPreviews ? (
                  <div className="flex h-36 items-center justify-center">
                    <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : recentSurveys.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-xs italic">
                    {t("noSurveys")}
                  </p>
                ) : (
                  <div className="space-y-3 text-xs">
                    {recentSurveys.map((s) => (
                      <div
                        key={s.id}
                        className="border-border/50 flex items-center justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0"
                      >
                        <div className="truncate">
                          <p className="text-foreground truncate font-medium">
                            {s.title}
                          </p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {s.orgName ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {t("responsesCount", { count: s.responseCount })}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="border-border bg-muted/20 border-t p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-primary w-full justify-between text-xs font-medium"
                >
                  <Link href="/system-admin/surveys">
                    <span>{t("viewAllSurveys")}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>

            {/* Card 3: Recent Studies */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="border-border border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardCheck className="size-4 text-emerald-500" />
                    {t("recentStudies")}
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t("top5Badge")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4">
                {loadingPreviews ? (
                  <div className="flex h-36 items-center justify-center">
                    <div className="border-primary size-5 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : recentStudies.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-xs italic">
                    {t("noStudies")}
                  </p>
                ) : (
                  <div className="space-y-3 text-xs">
                    {recentStudies.map((std) => (
                      <div
                        key={std.id}
                        className="border-border/50 flex items-center justify-between gap-2 border-b pb-2.5 last:border-0 last:pb-0"
                      >
                        <div className="truncate">
                          <p className="text-foreground truncate font-medium">
                            {std.title}
                          </p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {std.orgName ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {t("cycleBadge", { number: std.cycleNumber })}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="border-border bg-muted/20 border-t p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-primary w-full justify-between text-xs font-medium"
                >
                  <Link href="/system-admin/studies">
                    <span>{t("viewAllStudies")}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>
          </div>

          {/* Platform Governance & Security Alerts Widget */}
          <GovernanceWidget />
        </div>

        {/* Create Organization Dialog */}
        <CreateOrganizationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreated={loadDashboardData}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
