"use client";

import { Building2, CheckCircle2, Clock3, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supervisorOverviewService } from "@/services/supervisor-overview/supervisor-overview.service";
import type { SupervisorOverview } from "@/services/supervisor-overview/supervisor-overview.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/**
 * Program Supervisor's own dashboard — read-only, cross-organization. No
 * edit/create/delete affordance anywhere on this page (nor does the backend
 * grant this role any — see role-matrix.ts's center_supervisor entry).
 */
export function SupervisorDashboard({ userName }: { userName: string }) {
  const t = useTranslations("app.dashboard.supervisor");
  const [overview, setOverview] = useState<SupervisorOverview | null>(null);

  useEffect(() => {
    supervisorOverviewService
      .get()
      .then(setOverview)
      .catch(() => undefined);
  }, []);

  return (
    <PageContainer>
      <PageHeader title={t("title", { name: userName })} description={t("description")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("stats.totalOrganizations")}
          value={overview?.totalOrganizations ?? 0}
          icon={Building2}
        />
        <StatCard
          label={t("stats.studiesInProgress")}
          value={overview?.studiesInProgress ?? 0}
          icon={Clock3}
        />
        <StatCard
          label={t("stats.reportsShared")}
          value={overview?.reportsShared ?? 0}
          icon={FileText}
        />
        <StatCard
          label={t("stats.pendingSharingRequests")}
          value={overview?.pendingSharingRequests ?? 0}
          icon={CheckCircle2}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("orgColumn")}</TableHead>
                <TableHead>{t("activeStudyColumn")}</TableHead>
                <TableHead>{t("latestReportColumn")}</TableHead>
                <TableHead className="w-32">{t("sharingStatusColumn")}</TableHead>
                <TableHead className="w-36">{t("lastActivityColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview === null ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 5 }).map((__, cell) => (
                      <TableCell key={cell} className="py-4">
                        <div className="bg-muted h-4 w-24 rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : overview.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {t("noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                overview.rows.map((row) => (
                  <TableRow key={row.organizationId}>
                    <TableCell className="py-4 text-sm font-medium">
                      {row.organizationName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.activeStudyTitle ?? t("none")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.latestReportTitle ?? t("none")}
                    </TableCell>
                    <TableCell>
                      {row.sharingStatus ? (
                        <Badge variant="outline">{row.sharingStatus}</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(row.lastActivity)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
