"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, CheckCircle2, Clock3, FileText } from "lucide-react";
import { FormattedDate } from "@/components/common/formatted-date";
import { PageContainer } from "@/components/common/page-container";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { GeographicDistribution } from "@/components/features/dashboard/geographic-distribution";
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
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {t("title", { name: userName })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {t("description")}
          </p>
        </div>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Geographic Distribution Section */}
        <GeographicDistribution variant="ncnp" />

        {/* Cross-Org Supervisor Overview Table */}
        <Card className="border-border/60 overflow-hidden rounded-2xl shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-sm font-bold">{t("orgColumn")}</TableHead>
                  <TableHead className="text-sm font-bold">
                    {t("activeStudyColumn")}
                  </TableHead>
                  <TableHead className="text-sm font-bold">
                    {t("latestReportColumn")}
                  </TableHead>
                  <TableHead className="w-36 text-sm font-bold">
                    {t("sharingStatusColumn")}
                  </TableHead>
                  <TableHead className="w-40 text-sm font-bold">
                    {t("lastActivityColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 5 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : overview.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-8 text-center text-sm font-medium"
                    >
                      {t("noResults")}
                    </TableCell>
                  </TableRow>
                ) : (
                  overview.rows.map((row) => (
                    <TableRow key={row.organizationId} className="hover:bg-muted/30">
                      <TableCell className="py-4 text-sm font-semibold">
                        {row.organizationName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        {row.activeStudyTitle ?? t("none")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        {row.latestReportTitle ?? t("none")}
                      </TableCell>
                      <TableCell>
                        {row.sharingStatus ? (
                          <Badge variant="outline" className="font-semibold">
                            {row.sharingStatus}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        <FormattedDate value={row.lastActivity} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
