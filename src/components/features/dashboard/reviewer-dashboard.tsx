"use client";

import { AlarmClock, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
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

// Worst-case wins when several of a Study's Needs are each awaiting review —
// a single Study row showing "breached" if even one of its items has, rather
// than whichever alert happened to sort last.
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

// A Study can hold several Needs, each with its own pending alert — grouping
// by Study here (unlike the full Reviewer Alerts page, which legitimately
// lists one row per Need alongside its own Need statement/type/dates) avoids
// the same Study title appearing several times over with nothing to tell
// the rows apart, which read as a rendering bug rather than "3 separate
// Needs in this one Study need review."
function groupAlertsByStudy(alerts: SlaAlert[]): StudyAwaitingReview[] {
  const byStudy = new Map<string, SlaAlert[]>();
  for (const alert of alerts) {
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
        studyId: group[0]!.studyId,
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
    // "Recently Reviewed" must never show a Study that still has something
    // pending — the alerts list is the one source of truth for "not yet
    // acted on," so it's fetched first and used to filter the Studies list
    // below, rather than treating "recently touched" (updatedAt) as if it
    // meant "recently reviewed."
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

      {/* One table, not a duplicate card + table showing the same alerts —
       * this is the detailed view (Study, Due date, Status all at once). */}
      <Card>
        <CardContent className="space-y-3 p-6 pb-0">
          <h2 className="text-foreground text-sm font-semibold">
            {t("awaitingReviewHeading")}
          </h2>
        </CardContent>
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
              {studyRows === null ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 3 }).map((__, cell) => (
                      <TableCell key={cell} className="py-4">
                        <div className="bg-muted h-4 w-24 rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : studyRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {t("noAlerts")}
                  </TableCell>
                </TableRow>
              ) : (
                studyRows.slice(0, 5).map((row) => (
                  <TableRow key={row.studyId}>
                    <TableCell className="py-4 text-sm font-medium break-words whitespace-normal">
                      <Link href={`/studies/${row.studyId}`} className="hover:underline">
                        {row.studyTitle}
                      </Link>
                      {row.pendingCount > 1 ? (
                        <Badge variant="secondary" className="ml-2 font-normal">
                          {t("pendingCount", { count: row.pendingCount })}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(row.earliestDueAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t(`status.${row.worstStatus}`)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6">
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
    </PageContainer>
  );
}
