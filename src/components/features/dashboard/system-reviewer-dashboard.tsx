"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, CheckCircle2, ClipboardList, FileClock, XCircle } from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
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
import {
  ncnpReportReviewService,
  type NcnpReportReviewAlert,
  type NcnpReportReviewSummary,
} from "@/services/ncnp-report-review/ncnp-report-review.service";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function SystemReviewerDashboard({ userName }: { userName: string }) {
  const t = useTranslations("app.dashboard.systemReviewer");
  const [reviews, setReviews] = useState<NcnpReportReviewSummary[] | null>(null);
  const [alerts, setAlerts] = useState<NcnpReportReviewAlert[] | null>(null);

  useEffect(() => {
    ncnpReportReviewService
      .list()
      .then(setReviews)
      .catch(() => setReviews([]));
    ncnpReportReviewService
      .listAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, []);

  const totalCount = reviews?.length ?? 0;
  const pendingCount = reviews?.filter((r) => r.status === "draft").length ?? 0;
  const approvedCount = reviews?.filter((r) => r.status === "approved").length ?? 0;
  const releasedCount = reviews?.filter((r) => r.status === "released").length ?? 0;
  const rejectedCount = reviews?.filter((r) => r.status === "rejected").length ?? 0;
  const pendingReviews = reviews?.filter((r) => r.status === "draft") ?? [];

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

        {/* Overall summary */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label={t("stats.total")} value={totalCount} icon={ClipboardList} />
          <StatCard
            label={t("stats.pendingReview")}
            value={pendingCount}
            icon={FileClock}
          />
          <StatCard
            label={t("stats.approvedWaitingPublish")}
            value={approvedCount}
            icon={CheckCircle2}
          />
          <StatCard
            label={t("stats.released")}
            value={releasedCount}
            icon={CheckCircle2}
          />
          <StatCard label={t("stats.rejected")} value={rejectedCount} icon={XCircle} />
        </div>

        {/* Pending NCNP Reviews */}
        <Card className="border-border/60 overflow-hidden rounded-2xl shadow-sm">
          <CardContent className="p-6 pb-4">
            <h2 className="text-foreground text-lg font-bold">
              {t("pendingReviewsHeading")}
            </h2>
          </CardContent>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-sm font-bold">
                    {t("generatedByColumn")}
                  </TableHead>
                  <TableHead className="w-40 text-sm font-bold">
                    {t("generatedAtColumn")}
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 3 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : pendingReviews.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground py-8 text-center text-sm font-medium"
                    >
                      {t("noPendingReviews")}
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingReviews.map((review) => (
                    <TableRow key={review.id} className="hover:bg-muted/30">
                      <TableCell className="py-4 text-sm font-semibold">
                        {review.generatedByName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium">
                        {formatDate(review.generatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/reports/${review.id}?type=consolidated`}
                          className="text-primary text-sm font-semibold hover:underline"
                        >
                          {t("reviewLink")}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pending Merge Reviews — placeholder, feature not built yet */}
          <Card className="border-border/60 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-foreground text-lg font-bold">
                  {t("pendingMergeReviewsHeading")}
                </h2>
                <Badge variant="secondary">{t("comingSoon")}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {t("pendingMergeReviewsEmpty")}
              </p>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border/60 rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-foreground mb-3 flex items-center gap-2 text-lg font-bold">
                <Bell className="size-5" />
                {t("notificationsHeading")}
              </h2>
              {alerts === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-muted h-8 w-full animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noNotifications")}</p>
              ) : (
                <ul className="divide-border/60 divide-y">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-foreground">
                        {t(`alertType.${alert.type}`)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(alert.generatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
