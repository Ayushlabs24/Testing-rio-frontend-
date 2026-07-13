"use client";

import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LayoutGrid,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { organizationsService } from "@/services/organizations/organizations.service";
import { rolesService } from "@/services/roles/roles.service";
import { studiesService } from "@/services/studies/studies.service";
import { usersService } from "@/services/users/users.service";
import type { PlatformStudyStats } from "@/services/studies/studies.types";
import { PERMISSION_MODULES } from "@/types/permissions";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const t = useTranslations("app.dashboard");
  const { session } = useAuth();
  const isCrossEntity = session?.role.crossEntity ?? false;

  const [organizationCount, setOrganizationCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [roleCount, setRoleCount] = useState<number | null>(null);
  const [studyStats, setStudyStats] = useState<PlatformStudyStats | null>(null);

  useEffect(() => {
    if (isCrossEntity) {
      // System Admin / Center Supervisor: a platform-wide view — every
      // org's data, not just their own.
      organizationsService.listAll().then((organizations) => {
        setOrganizationCount(organizations.length);
        setUserCount(organizations.reduce((sum, org) => sum + org.memberCount, 0));
      });
      studiesService.getPlatformStats().then(setStudyStats);
    } else {
      rolesService
        .list()
        .then((roles) => setRoleCount(roles.filter((role) => role.enabled).length));
      usersService.listByOrganization().then((users) => setUserCount(users.length));
    }
  }, [isCrossEntity]);

  return (
    <PageContainer>
      <PageHeader
        title={t("title", { name: session?.user.name ?? "" })}
        description={t(isCrossEntity ? "descriptionGlobal" : "description")}
      />
      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2",
          isCrossEntity ? "lg:grid-cols-5" : "lg:grid-cols-3",
        )}
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
              icon={CheckCircle2}
            />
            <StatCard
              label={t("stats.reportsGenerated")}
              value={studyStats?.reportsGenerated ?? 0}
              icon={FileText}
            />
          </>
        ) : (
          <>
            <StatCard label={t("stats.users")} value={userCount ?? 0} icon={Users2} />
            <StatCard
              label={t("stats.roles")}
              value={roleCount ?? 0}
              icon={ShieldCheck}
            />
            <StatCard
              label={t("stats.modules")}
              value={PERMISSION_MODULES.length}
              icon={LayoutGrid}
            />
          </>
        )}
      </div>
    </PageContainer>
  );
}
