"use client";

import { AlarmClock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { markReviewerSlaAlertsSeen } from "@/hooks/use-reviewer-sla-badge";
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

// Links straight to the Need detail page rather than the separate Survey
// Builder Review page — one destination for the Approver to Override the
// domain, curate questions, and Approve & Publish, instead of two different
// screens. Same destination works for a Research Officer's own resolved
// alerts (survey_approved/survey_rejected) — the Need workspace page shows
// the Survey's current state either way.
function alertHref(alert: SlaAlert): string {
  return `/studies/${alert.studyId}/needs/${alert.needId}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function ReviewerSlaPage() {
  const t = useTranslations("app.reviewerSla");
  const { session } = useAuth();
  // Which of the two queues ReviewerSlaService.listAlerts returns depends
  // entirely on this — a Reviewer/Approver gets the org-wide "awaiting your
  // decision" queue (no concept of assignment: once anyone reviews an item,
  // it disappears for everyone); anyone else with access here (a Research
  // Officer) gets their OWN submitted surveys' resolved status instead —
  // already-decided, so the SLA due/breach concept below doesn't apply to
  // their rows at all.
  const canApprove = usePermission("surveyBuilder", "approve");
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
        // Mark every currently-loaded alert as seen — the topbar/sidebar
        // unread badge (useReviewerSlaBadge) clears for these once the user
        // has actually viewed this page while they were present.
        if (session?.user.id) markReviewerSlaAlertsSeen(session.user.id, rows);
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
    // loadAlerts is redefined every render (it closes over `session`, which
    // only ever grows more defined post-login, never meaningfully changes
    // mid-session) — intentionally run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll interval is server-configurable (RIO-NFR-014) — the frontend never
  // hardcodes it, it just reads whatever the backend currently returns.
  useEffect(() => {
    if (!config) return;
    intervalRef.current = setInterval(loadAlerts, config.pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const summary = useMemo(() => {
    const counts = { pending: 0, at_risk: 0, breached: 0 };
    for (const alert of alerts ?? []) counts[alert.status] += 1;
    return counts;
  }, [alerts]);

  return (
    <PermissionGuard module="surveyBuilder" action="read">
      <PageContainer>
        <PageHeader
          title={canApprove ? t("title") : t("titleOwn")}
          description={
            canApprove
              ? config
                ? `${t("description")} ${t("slaNote", { hours: config.slaHours, seconds: Math.round(config.pollIntervalMs / 1000) })}`
                : t("description")
              : t("descriptionOwn")
          }
        />

        {canApprove ? (
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
        ) : null}

        <Card>
          <CardContent className="p-0">
            <TooltipProvider delayDuration={200}>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">{t("typeColumn")}</TableHead>
                    <TableHead className="w-[26%]">{t("studyColumn")}</TableHead>
                    <TableHead className="w-[26%]">{t("needColumn")}</TableHead>
                    <TableHead className="w-40">{t("createdColumn")}</TableHead>
                    {/* Due/breach only applies to the still-open Approver
                        queue — a Research Officer's alerts are already
                        resolved, there's nothing left to be "at risk" of. */}
                    {canApprove ? (
                      <TableHead className="w-40">{t("dueColumn")}</TableHead>
                    ) : null}
                    {canApprove ? (
                      <TableHead className="w-28">{t("statusColumn")}</TableHead>
                    ) : null}
                    <TableHead className="w-32">{t("actionColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts === null ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({ length: canApprove ? 7 : 5 }).map((__, cell) => (
                          <TableCell key={cell} className="py-4">
                            <div className="bg-muted h-4 w-24 rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : alerts.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canApprove ? 7 : 5}
                        className="text-muted-foreground h-32 text-center"
                      >
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                            <AlarmClock className="size-5" />
                          </div>
                          <p>
                            {loadFailed
                              ? t("loadError")
                              : canApprove
                                ? t("noAlerts")
                                : t("noAlertsOwn")}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="py-4 align-top whitespace-nowrap">
                          <Badge variant="outline" className="font-normal">
                            {t(`type.${alert.type}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 align-top text-sm font-medium break-words whitespace-normal">
                          <Link href={alertHref(alert)} className="hover:underline">
                            {alert.studyTitle}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-0 py-4 align-top text-sm">
                          {alert.needStatement || alert.comments ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="cursor-default truncate">
                                  {alert.comments ?? alert.needStatement}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm text-wrap">
                                {alert.needStatement}
                                {alert.comments ? (
                                  <>
                                    <br />
                                    <span className="font-medium">
                                      {t("commentsLabel")}:{" "}
                                    </span>
                                    {alert.comments}
                                  </>
                                ) : null}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            t("noNeedStatement")
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-4 align-top text-sm whitespace-nowrap">
                          {formatDate(alert.createdAt)}
                        </TableCell>
                        {canApprove ? (
                          <TableCell className="text-muted-foreground py-4 align-top text-sm whitespace-nowrap">
                            {formatDate(alert.dueAt)}
                          </TableCell>
                        ) : null}
                        {canApprove ? (
                          <TableCell className="py-4 align-top whitespace-nowrap">
                            <Badge variant={STATUS_VARIANT[alert.status]}>
                              {t(`status.${alert.status}`)}
                            </Badge>
                          </TableCell>
                        ) : null}
                        <TableCell className="py-4 align-top whitespace-nowrap">
                          <Button asChild size="sm" variant="outline">
                            <Link href={alertHref(alert)}>
                              {canApprove ? t("reviewNow") : t("viewNow")}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
