"use client";

import {
  AlertTriangle,
  Info,
  ListChecks,
  Minus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Timer,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BarChart } from "@/components/features/reports/report-charts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { collectiveDashboardService } from "@/services/collective-dashboard/collective-dashboard.service";
import type { CollectiveDashboard as Data } from "@/services/collective-dashboard/collective-dashboard.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
        <div>
          <p className="text-foreground text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendIcon({ direction }: { direction: "up" | "down" | "flat" }) {
  if (direction === "up")
    return <TrendingUp className="text-destructive size-4 shrink-0" />;
  if (direction === "down")
    return <TrendingDown className="size-4 shrink-0 text-emerald-600" />;
  return <Minus className="text-muted-foreground size-4 shrink-0" />;
}

const ANOMALY_STYLE: Record<
  Data["executiveSummary"]["anomalies"][number]["severity"],
  string
> = {
  critical: "text-destructive",
  warning: "text-amber-600",
  info: "text-muted-foreground",
};

export function CollectiveDashboard() {
  const t = useTranslations("app.dashboard.collective");
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    collectiveDashboardService
      .get()
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return <p className="text-muted-foreground text-sm">{t("loadError")}</p>;
  }
  if (!data) {
    return <div className="bg-muted h-40 animate-pulse rounded-md" />;
  }

  const { kpis, executiveSummary: exec, scope } = data;
  const maxCount = Math.max(1, ...kpis.scoringDistribution.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg font-semibold">{t("heading")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("subtitle", {
            studies: scope.studyCount,
            date: formatDate(scope.generatedAt),
          })}
        </p>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label={t("kpi.needs")}
          value={String(kpis.needCount)}
          icon={<ListChecks className="size-5" />}
        />
        <Kpi
          label={t("kpi.sla")}
          value={kpis.slaCompliancePct === null ? "—" : `${kpis.slaCompliancePct}%`}
          icon={<ShieldCheck className="size-5" />}
        />
        <Kpi
          label={t("kpi.breaches")}
          value={String(kpis.slaBreaches)}
          icon={<Timer className="size-5" />}
        />
        <Kpi
          label={t("kpi.studies")}
          value={String(scope.studyCount)}
          icon={<ListChecks className="size-5" />}
        />
      </div>

      {/* Scoring distribution */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h3 className="text-foreground text-sm font-semibold">{t("scoringHeading")}</h3>
          <BarChart
            max={maxCount}
            bars={kpis.scoringDistribution.map((s) => ({
              label: s.band,
              value: s.count,
            }))}
          />
        </CardContent>
      </Card>

      {/* Executive summary */}
      <Card>
        <CardContent className="space-y-6 p-6">
          <h3 className="text-foreground text-sm font-semibold">{t("execHeading")}</h3>

          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("topPriorities")}
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t("col.need")}</TableHead>
                    <TableHead>{t("col.domain")}</TableHead>
                    <TableHead className="text-right">{t("col.severity")}</TableHead>
                    <TableHead>{t("col.entity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exec.topPriorities.map((p) => (
                    <TableRow key={p.rank}>
                      <TableCell className="text-muted-foreground">{p.rank}</TableCell>
                      <TableCell className="font-medium">{p.label}</TableCell>
                      <TableCell>{p.domain}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.severityScore}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.entity ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("trends")}
              </p>
              <ul className="space-y-2">
                {exec.trends.map((tr, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <TrendIcon direction={tr.direction} />
                    <span>
                      <span className="text-foreground font-medium">{tr.label}</span>
                      <span className="text-muted-foreground"> — {tr.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("anomalies")}
              </p>
              <ul className="space-y-2">
                {exec.anomalies.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {a.severity === "info" ? (
                      <Info className={`${ANOMALY_STYLE[a.severity]} size-4 shrink-0`} />
                    ) : (
                      <AlertTriangle
                        className={`${ANOMALY_STYLE[a.severity]} size-4 shrink-0`}
                      />
                    )}
                    <span className="text-foreground">{a.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {exec.reviewerNotes.length > 0 ? (
            <section className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("reviewerNotes")}
              </p>
              <ul className="space-y-2">
                {exec.reviewerNotes.map((n, i) => (
                  <li key={i} className="border-border rounded-md border p-3 text-sm">
                    <p className="text-foreground">{n.note}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {n.author} · {formatDate(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
