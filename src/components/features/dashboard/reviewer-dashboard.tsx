"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlarmClock, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
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
import { Link } from "@/i18n/navigation";
import { reviewerSlaService } from "@/services/reviewer-sla/reviewer-sla.service";
import type {
  SlaAlert,
  SlaAlertStatus,
} from "@/services/reviewer-sla/reviewer-sla.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

const STATUS_RANK: Record<SlaAlertStatus, number> = {
  breached: 2,
  at_risk: 1,
  pending: 0,
};

interface StudyAwaitingReview {
  studyId: string;
  studyTitle: string;
  pendingCount: number;
  earliestDueAt: string;
  worstStatus: SlaAlertStatus;
}

// This table is specifically "Studies awaiting review" — links straight to
// `/studies/{studyId}`, so it only makes sense for Study-scoped alerts
// (survey_approval). Report alerts (report_approval) have no Study to link
// through in the org-wide case, and even when a Report is Study-scoped,
// mixing "a report needs approval" into a per-Study Survey-review table
// would be a different kind of item than this table is built to show —
// filtered out here rather than force-fit in. The KPI cards above this
// table intentionally do still count every pending alert type, including
// reports — this filtering is specific to this one table.
function groupAlertsByStudy(alerts: SlaAlert[]): StudyAwaitingReview[] {
  const byStudy = new Map<string, SlaAlert[]>();
  for (const alert of alerts) {
    if (alert.studyId === null) continue;
    const existing = byStudy.get(alert.studyId);
    if (existing) existing.push(alert);
    else byStudy.set(alert.studyId, [alert]);
  }
  return [...byStudy.values()]
    .map((group) => {
      const earliestDueAt = group.reduce(
        (min, a) => (new Date(a.dueAt) < new Date(min) ? a.dueAt : min),
        group[0]!.dueAt,
      );
      const worstStatus = group.reduce(
        (worst, a) => (STATUS_RANK[a.status] > STATUS_RANK[worst] ? a.status : worst),
        group[0]!.status,
      );
      return {
        // Guaranteed non-null — the loop above only ever pushes into
        // `byStudy` for alerts whose studyId already passed the null check.
        studyId: group[0]!.studyId!,
        studyTitle: group[0]!.studyTitle,
        pendingCount: group.length,
        earliestDueAt,
        worstStatus,
      };
    })
    .sort(
      (a, b) => new Date(a.earliestDueAt).getTime() - new Date(b.earliestDueAt).getTime(),
    );
}

export function ReviewerDashboard({ userName }: { userName: string }) {
  const t = useTranslations("app.dashboard.reviewer");
  const [alerts, setAlerts] = useState<SlaAlert[] | null>(null);
  const [recentlyReviewed, setRecentlyReviewed] = useState<StudySummary[] | null>(null);

  useEffect(() => {
    reviewerSlaService
      .listAlerts()
      .then((list) => {
        setAlerts(list);
        return list;
      })
      .catch(() => {
        setAlerts([]);
        return [];
      })
      .then((currentAlerts) => {
        const pendingStudyIds = new Set(currentAlerts.map((a) => a.studyId));
        studiesService
          .list({ limit: 20 })
          .then((rows) => {
            const sorted = [...rows]
              .filter((study) => !pendingStudyIds.has(study.id))
              .sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
              );
            setRecentlyReviewed(sorted.slice(0, 5));
          })
          .catch(() => setRecentlyReviewed([]));
      });
  }, []);

  const pendingCount = alerts?.length ?? 0;
  const atRiskCount = alerts?.filter((a) => a.status === "at_risk").length ?? 0;
  const breachedCount = alerts?.filter((a) => a.status === "breached").length ?? 0;
  const studyRows = useMemo(() => (alerts ? groupAlertsByStudy(alerts) : null), [alerts]);

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

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label={t("stats.pendingAiReviews")}
            value={pendingCount}
            icon={AlarmClock}
          />
          <StatCard label={t("stats.atRisk")} value={atRiskCount} icon={Clock3} />
          <StatCard
            label={t("stats.breached")}
            value={breachedCount}
            icon={ShieldAlert}
          />
        </div>

        {/* Studies Awaiting Review Table Card */}
        <Card className="border-border/60 overflow-hidden rounded-2xl shadow-sm">
          <CardContent className="p-6 pb-4">
            <h2 className="text-foreground text-lg font-bold">
              {t("awaitingReviewHeading")}
            </h2>
          </CardContent>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-sm font-bold">{t("studyColumn")}</TableHead>
                  <TableHead className="w-40 text-sm font-bold">
                    {t("dueColumn")}
                  </TableHead>
                  <TableHead className="w-32 text-sm font-bold">
                    {t("statusColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studyRows === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 3 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : studyRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground py-8 text-center text-sm font-medium"
                    >
                      {t("noAlerts")}
                    </TableCell>
                  </TableRow>
                ) : (
                  studyRows.slice(0, 5).map((row) => (
                    <TableRow key={row.studyId} className="hover:bg-muted/30">
                      <TableCell className="py-4 text-sm font-semibold break-words whitespace-normal">
                        <Link
                          href={`/studies/${row.studyId}`}
                          className="text-foreground hover:text-primary hover:underline"
                        >
                          {row.studyTitle}
                        </Link>
                        {row.pendingCount > 1 ? (
                          <Badge variant="secondary" className="ml-2.5 font-medium">
                            {t("pendingCount", { count: row.pendingCount })}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        {formatDate(row.earliestDueAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-semibold">
                        <Badge
                          variant={
                            row.worstStatus === "breached" ? "destructive" : "outline"
                          }
                          className="font-semibold"
                        >
                          {t(`status.${row.worstStatus}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Geographic Distribution Section */}
        <GeographicDistribution variant="ngo" />

        {/* Recently Reviewed Card */}
        <Card className="border-border/60 rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-foreground mb-4 flex items-center gap-2 text-lg font-bold">
              <CheckCircle2 className="size-5 text-emerald-500" />
              {t("recentlyReviewedHeading")}
            </h2>
            {recentlyReviewed === null ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted h-10 w-full animate-pulse rounded-xl"
                  />
                ))}
              </div>
            ) : recentlyReviewed.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm font-medium">
                {t("noRecentlyReviewed")}
              </p>
            ) : (
              <div className="divide-border/60 border-border/60 divide-y overflow-hidden rounded-xl border">
                {recentlyReviewed.map((study) => (
                  <Link
                    key={study.id}
                    href={`/studies/${study.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors"
                  >
                    <span className="text-foreground truncate font-semibold">
                      {study.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs font-medium">
                      {formatDate(study.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
