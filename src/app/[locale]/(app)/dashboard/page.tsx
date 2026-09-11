"use client";

import {
  Building2,
  ClipboardCheck,
  FileText,
  LayoutGrid,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { useAutoTranslate } from "@/hooks/use-auto-translate";
import { PageContainer } from "@/components/common/page-container";
import { CollectiveDashboard } from "@/components/features/dashboard/collective-dashboard";
import { ResearchOfficerDashboard } from "@/components/features/dashboard/research-officer-dashboard";
import { ReviewerDashboard } from "@/components/features/dashboard/reviewer-dashboard";
import { SystemReviewerDashboard } from "@/components/features/dashboard/system-reviewer-dashboard";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { GeographicDistribution } from "@/components/features/dashboard/geographic-distribution";
import { HistoricalComparison } from "@/components/features/dashboard/historical-comparison";
import SystemAdminDashboardPage from "../system-admin/dashboard/page";
import { SupervisorDashboard } from "@/components/features/dashboard/supervisor-dashboard";
import { organizationsService } from "@/services/organizations/organizations.service";
import { rolesService } from "@/services/roles/roles.service";
import { studiesService } from "@/services/studies/studies.service";
import { usersService } from "@/services/users/users.service";
import type { PlatformStudyStats } from "@/services/studies/studies.types";
import { PERMISSION_MODULES } from "@/types/permissions";

export default function DashboardPage() {
  const t = useTranslations("app.dashboard");
  const { session } = useAuth();
  const userName = useAutoTranslate(session?.user.name).text;
  const isCrossEntity = session?.role.crossEntity ?? false;
  const canReadUsers = usePermission("entityTeam", "read");
  const canReadRoles = usePermission("rolesPermissions", "read");
  const canReadReports = usePermission("reportsDashboards", "read");

  const [organizationCount, setOrganizationCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [roleCount, setRoleCount] = useState<number | null>(null);
  const [studyStats, setStudyStats] = useState<PlatformStudyStats | null>(null);

  useEffect(() => {
    if (isCrossEntity) {
      organizationsService
        .listAll()
        .then((organizations) => {
          setOrganizationCount(organizations.length);
          setUserCount(organizations.reduce((sum, org) => sum + org.memberCount, 0));
        })
        .catch(() => undefined);
      studiesService
        .getPlatformStats()
        .then(setStudyStats)
        .catch(() => undefined);
    } else {
      if (canReadRoles) {
        rolesService
          .list()
          .then((roles) => setRoleCount(roles.filter((role) => role.enabled).length))
          .catch(() => undefined);
      }
      if (canReadUsers) {
        usersService
          .listByOrganization()
          .then((users) => setUserCount(users.length))
          .catch(() => undefined);
      }
    }
  }, [isCrossEntity, canReadUsers, canReadRoles]);

  /* ── Role-specific dashboard overrides ─────────────────────────────── */
  if (session?.role.key === "system_admin") {
    return <SystemAdminDashboardPage />;
  }
  if (session?.role.key === "center_supervisor") {
    return <SupervisorDashboard userName={userName} />;
  }
  if (session?.role.key === "human_reviewer") {
    return <ReviewerDashboard userName={userName} />;
  }
  if (session?.role.key === "ngo_research_officer") {
    return <ResearchOfficerDashboard userName={userName} />;
  }
  if (session?.role.key === "system_reviewer") {
    return <SystemReviewerDashboard userName={userName} />;
  }

  /* ── NGO Admin Dashboard ────────────────────────────────────────────── */
  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {t("title", { name: userName })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t(isCrossEntity ? "descriptionGlobal" : "description")}
          </p>
        </div>

        {/* ── KPI Stat Cards ────────────────────────────────────────────── */}
        <div
          className={
            isCrossEntity
              ? "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5"
              : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          {isCrossEntity ? (
            <>
              <StatCard
                label={t("stats.organizations")}
                value={organizationCount ?? 0}
                icon={Building2}
              />
              <StatCard label={t("stats.users")} value={userCount ?? 0} icon={Users2} />
              <StatCard
                label={t("stats.activeStudies")}
                value={studyStats?.activeStudies ?? 0}
                icon={ClipboardCheck}
              />
              <StatCard
                label={t("stats.pendingReviews")}
                value={studyStats?.pendingReviews ?? 0}
                icon={ClipboardCheck}
                badge={
                  (studyStats?.pendingReviews ?? 0) > 0
                    ? { text: t("stats.pendingBadge"), variant: "attention" }
                    : undefined
                }
              />
              <StatCard
                label={t("stats.reportsGenerated")}
                value={studyStats?.reportsGenerated ?? 0}
                icon={FileText}
              />
            </>
          ) : (
            <>
              {canReadUsers ? (
                <StatCard label={t("stats.users")} value={userCount ?? 0} icon={Users2} />
              ) : null}
              {canReadRoles ? (
                <StatCard
                  label={t("stats.roles")}
                  value={roleCount ?? 0}
                  icon={ShieldCheck}
                />
              ) : null}
              <StatCard
                label={t("stats.modules")}
                value={PERMISSION_MODULES.length}
                icon={LayoutGrid}
              />
            </>
          )}
        </div>

        {/* ── Geographic Distribution Section ───────────────────────────── */}
        <GeographicDistribution variant="ngo" />

        {/* ── Prior-study comparison (RIO-DATA-002) ────────────────────── */}
        {/* Imported prior-study needs land in this same dashboard, so the
            comparison sits beside the current-data panels rather than on a
            page of its own. */}
        <HistoricalComparison />

        {/* ── Collective Dashboard (NGO Analytics) ─────────────────────── */}
        {canReadReports ? <CollectiveDashboard /> : null}
      </div>
    </PageContainer>
  );
}
