"use client";

import { AlarmClock, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
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
import type { SlaAlert } from "@/services/reviewer-sla/reviewer-sla.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/**
 * Human Reviewer's own dashboard — their work starts at the pending review
 * queue, not executive/org stats (they don't hold entityTeam/rolesPermissions
 * read access anyway — see role-matrix.ts's human_reviewer entry). Reuses
 * the same data the Reviewer Alerts page and Studies list already show, just
 * surfaced as an at-a-glance summary instead of requiring a page visit.
 */
export function ReviewerDashboard({ userName }: { userName: string }) {
  const t = useTranslations("app.dashboard.reviewer");
  const [alerts, setAlerts] = useState<SlaAlert[] | null>(null);
  const [recentlyReviewed, setRecentlyReviewed] = useState<StudySummary[] | null>(null);

  useEffect(() => {
    reviewerSlaService
      .listAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
    studiesService
      .list({ status: "human_reviewed", limit: 20 })
      .then((rows) => {
        const sorted = [...rows].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        setRecentlyReviewed(sorted.slice(0, 5));
      })
      .catch(() => setRecentlyReviewed([]));
  }, []);

  const pendingCount = alerts?.length ?? 0;
  const atRiskCount = alerts?.filter((a) => a.status === "at_risk").length ?? 0;
  const breachedCount = alerts?.filter((a) => a.status === "breached").length ?? 0;
  const studiesAwaitingReview = alerts
    ? Array.from(new Map(alerts.map((a) => [a.studyId, a])).values())
    : null;

  return (
    <PageContainer>
      <PageHeader title={t("title", { name: userName })} description={t("description")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("stats.pendingAiReviews")}
          value={pendingCount}
          icon={AlarmClock}
        />
        <StatCard label={t("stats.atRisk")} value={atRiskCount} icon={Clock3} />
        <StatCard label={t("stats.breached")} value={breachedCount} icon={ShieldAlert} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-foreground text-sm font-semibold">
              {t("awaitingReviewHeading")}
            </h2>
            {studiesAwaitingReview === null ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted h-9 w-full rounded" />
                ))}
              </div>
            ) : studiesAwaitingReview.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("noStudiesAwaitingReview")}
              </p>
            ) : (
              <div className="divide-border divide-y rounded-md border">
                {studiesAwaitingReview.map((alert) => (
                  <Link
                    key={alert.aiDecisionId}
                    href={`/studies/${alert.studyId}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <span className="truncate font-medium">{alert.studyTitle}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(alert.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="text-badge-success-foreground size-4" />
              {t("recentlyReviewedHeading")}
            </h2>
            {recentlyReviewed === null ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted h-9 w-full rounded" />
                ))}
              </div>
            ) : recentlyReviewed.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noRecentlyReviewed")}</p>
            ) : (
              <div className="divide-border divide-y rounded-md border">
                {recentlyReviewed.map((study) => (
                  <Link
                    key={study.id}
                    href={`/studies/${study.id}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                  >
                    <span className="truncate font-medium">{study.title}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(study.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studyColumn")}</TableHead>
                  <TableHead className="w-36">{t("dueColumn")}</TableHead>
                  <TableHead className="w-28">{t("statusColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 3 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : alerts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground h-24 text-center"
                    >
                      {t("noAlerts")}
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.slice(0, 5).map((alert) => (
                    <TableRow key={alert.aiDecisionId}>
                      <TableCell className="py-4 text-sm font-medium break-words whitespace-normal">
                        <Link
                          href={`/studies/${alert.studyId}`}
                          className="hover:underline"
                        >
                          {alert.studyTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(alert.dueAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {t(`status.${alert.status}`)}
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
