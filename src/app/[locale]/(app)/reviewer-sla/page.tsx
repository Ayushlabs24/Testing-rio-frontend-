"use client";

import { AlarmClock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SlaConfig,
} from "@/services/reviewer-sla/reviewer-sla.types";

const STATUS_VARIANT: Record<SlaAlertStatus, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  at_risk: "default",
  breached: "destructive",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ReviewerSlaPage() {
  const t = useTranslations("app.reviewerSla");
  const { session } = useAuth();
  // Backend already scopes the response to just this reviewer's assigned
  // studies when the caller is a Reviewer/Approver (human_reviewer — see
  // ReviewerSlaService.listAlerts) — this only decides which empty-state
  // copy to show, it doesn't filter anything itself.
  const isReviewerApprover = session?.role.key === "human_reviewer";
  const [config, setConfig] = useState<SlaConfig | null>(null);
  const [alerts, setAlerts] = useState<SlaAlert[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function loadAlerts() {
    reviewerSlaService
      .listAlerts()
      .then((rows) => {
        setAlerts(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setAlerts([]);
        setLoadFailed(true);
      });
  }

  useEffect(() => {
    reviewerSlaService
      .getConfig()
      .then(setConfig)
      .catch(() => undefined);
    loadAlerts();
  }, []);

  // Poll interval is server-configurable (RIO-NFR-014) — the frontend never
  // hardcodes it, it just reads whatever the backend currently returns.
  useEffect(() => {
    if (!config) return;
    intervalRef.current = setInterval(loadAlerts, config.pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [config]);

  const summary = useMemo(() => {
    const counts = { pending: 0, at_risk: 0, breached: 0 };
    for (const alert of alerts ?? []) counts[alert.status] += 1;
    return counts;
  }, [alerts]);

  return (
    <PermissionGuard module="aiReview" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={
            config
              ? `${t("description")} ${t("slaNote", { hours: config.slaHours, seconds: Math.round(config.pollIntervalMs / 1000) })}`
              : t("description")
          }
        />

        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{t("summaryPending")}</p>
              <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                {summary.pending}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{t("summaryAtRisk")}</p>
              <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                {summary.at_risk}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{t("summaryBreached")}</p>
              <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                {summary.breached}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studyColumn")}</TableHead>
                  <TableHead>{t("needColumn")}</TableHead>
                  <TableHead className="w-40">{t("assignedReviewerColumn")}</TableHead>
                  <TableHead className="w-44">{t("createdColumn")}</TableHead>
                  <TableHead className="w-44">{t("dueColumn")}</TableHead>
                  <TableHead className="w-28">{t("statusColumn")}</TableHead>
                  <TableHead className="w-32">{t("actionColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : alerts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <AlarmClock className="size-5" />
                        </div>
                        <p>
                          {loadFailed
                            ? t("loadError")
                            : isReviewerApprover
                              ? t("noAlertsAssignedToYou")
                              : t("noAlerts")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((alert) => (
                    <TableRow key={alert.aiDecisionId}>
                      <TableCell className="py-4 text-sm font-medium">
                        <Link
                          href={`/studies/${alert.studyId}`}
                          className="hover:underline"
                        >
                          {alert.studyTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-64 truncate text-sm">
                        {alert.needStatement ?? t("noNeedStatement")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {alert.assignedReviewerName ?? t("unassigned")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(alert.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(alert.dueAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[alert.status]}>
                          {t(`status.${alert.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/studies/${alert.studyId}`}>{t("reviewNow")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
