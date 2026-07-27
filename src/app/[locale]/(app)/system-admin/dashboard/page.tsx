"use client";

import {
  Building2,
  ClipboardCheck,
  FileText,
  PlusCircle,
  Users2,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { StudiesByStage } from "@/components/features/dashboard/studies-by-stage";
import { AuditActivityTimeline } from "@/components/features/dashboard/audit-activity-timeline";
import { SystemStatusPanel } from "@/components/features/dashboard/system-status-panel";
import { GeographicDistribution } from "@/components/features/dashboard/geographic-distribution";
import { Button } from "@/components/ui/button";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { studiesService } from "@/services/studies/studies.service";
import type { PlatformStudyStats } from "@/services/studies/studies.types";
import { CreateOrganizationDialog } from "../organizations/_components/create-organization-dialog";
import { GovernanceWidget } from "../_components/governance-widget";

export default function SystemAdminDashboardPage() {
  const t = useTranslations("systemAdmin.dashboard");
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [studyStats, setStudyStats] = useState<PlatformStudyStats | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadDashboardData = () => {
    organizationsService
      .listAll()
      .then(setOrganizations)
      .catch(() => undefined);
    studiesService
      .getPlatformStats()
      .then(setStudyStats)
      .catch(() => undefined);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  /* ── Derived counts ─────────────────────────────────────────────────── */
  const totalOrgs = organizations?.length ?? 0;
  const activeOrgsCount = organizations?.filter((o) => o.isActive).length ?? 0;
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
  const pendingReviews = studyStats?.pendingReviews ?? 0;

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-8">
          {/* ── Page Header ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("description")}</p>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2 rounded-xl"
            >
              <PlusCircle className="size-4" />
              {t("createOrganization")}
            </Button>
          </div>

          {/* ── 6 Top Stat Cards (3 per row on desktop) ─────────────────── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label={t("totalOrganizations")}
              value={totalOrgs}
              icon={Building2}
              description={t("activeOrgsDescription", { count: activeOrgsCount })}
            />
            <StatCard
              label={t("totalUsers")}
              value={totalUsersCount}
              icon={Users2}
              description={t("acrossAllOrgs")}
            />
            <StatCard
              label={t("totalStudies")}
              value={totalStudiesCount}
              icon={ClipboardCheck}
              description={t("acrossAllOrgs")}
            />
            <StatCard
              label={t("totalSurveys")}
              value={totalSurveysCount}
              icon={BarChart3}
              description={t("acrossAllOrgs")}
            />
            <StatCard
              label={t("publishedReports")}
              value={publishedReportsCount}
              icon={FileText}
              description={t("acrossAllOrgs")}
            />
            <StatCard
              label={t("responsesCollected")}
              value="—"
              icon={AlertCircle}
              description={t("acrossAllOrgs")}
            />
          </div>

          {/* ── Geographic Distribution Section ───────────────────────────── */}
          <GeographicDistribution variant="ncnp" />

          {/* ── Studies by Stage + Latest Audit Activity ─────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Studies by Stage — 2/5 width */}
            <div className="border-border/60 bg-card col-span-1 rounded-2xl border p-6 shadow-sm lg:col-span-2">
              <StudiesByStage
                surveyInReview={pendingReviews}
                collecting={Math.max(
                  0,
                  totalStudiesCount - pendingReviews - publishedReportsCount,
                )}
                reportInReview={0}
                published={publishedReportsCount}
              />
            </div>

            {/* Latest Audit Activity — 3/5 width */}
            <div className="border-border/60 bg-card col-span-1 rounded-2xl border p-6 shadow-sm lg:col-span-3">
              <AuditActivityTimeline limit={8} />
            </div>
          </div>

          {/* ── System Status ────────────────────────────────────────────── */}
          <div className="border-border/60 bg-card rounded-2xl border p-6 shadow-sm">
            <SystemStatusPanel />
          </div>

          {/* ── Platform Governance & Security Alerts ────────────────────── */}
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
