"use client";

import {
  Activity,
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardList,
  Gauge as GaugeIcon,
  Info,
  ListChecks,
  Minus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { Link } from "@/i18n/navigation";
import type { PermissionAction, PermissionModule } from "@/types/permissions";
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
    <Card className="transition-shadow hover:shadow-md">
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

// ── Quick Actions — permission-gated shortcuts into the rest of the app ──────

interface QuickLink {
  key: string;
  href: string;
  icon: LucideIcon;
  module: PermissionModule;
  action?: PermissionAction;
  titleKey: string;
  descKey: string;
}

// Four shortcuts so the row shares the KPI band's 4-column grid — every card
// edge lines up with the KPI card beneath it.
const QUICK_LINKS: QuickLink[] = [
  {
    key: "priority",
    href: "/priority-dashboard",
    icon: GaugeIcon,
    module: "priorityScoring",
    titleKey: "quickNav.priority",
    descKey: "quickNav.priorityDesc",
  },
  {
    key: "reports",
    href: "/reports",
    icon: BarChart3,
    module: "reportsDashboards",
    titleKey: "quickNav.reports",
    descKey: "quickNav.reportsDesc",
  },
  {
    key: "studies",
    href: "/studies",
    icon: ClipboardList,
    module: "studySurvey",
    titleKey: "quickNav.studies",
    descKey: "quickNav.studiesDesc",
  },
  {
    key: "reviewer",
    href: "/reviewer-sla",
    icon: AlarmClock,
    module: "aiReview",
    titleKey: "quickNav.reviewer",
    descKey: "quickNav.reviewerDesc",
  },
];

function QuickNav({ t }: { t: ReturnType<typeof useTranslations> }) {
  // Hooks can't run in a loop conditionally — resolve every permission, then filter.
  const grants = [
    usePermission("priorityScoring"),
    usePermission("reportsDashboards"),
    usePermission("studySurvey"),
    usePermission("aiReview"),
  ];
  const links = QUICK_LINKS.filter((_, i) => grants[i]);
  if (links.length === 0) return null;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col space-y-1 p-6">
        <h3 className="text-foreground text-sm font-semibold">{t("quickNav.title")}</h3>
        <div className="grid flex-1 grid-cols-2 gap-3 pt-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.key}
                href={l.href}
                className="group border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-ring flex flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-9 items-center justify-center rounded-lg transition-colors">
                    <Icon className="size-4.5" />
                  </div>
                  <ArrowRight className="text-muted-foreground size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">{t(l.titleKey)}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{t(l.descKey)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Scoring Distribution — premium donut + severity breakdown ────────────────

// Severity bands are a STATUS encoding — reserved status colors, always paired
// with a label + count so identity is never colour-alone (red/green CVD-safe).
const BAND_META: Record<string, { color: string; tint: string; icon: LucideIcon }> = {
  High: {
    color: "var(--destructive)",
    tint: "bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
  Medium: { color: "var(--warning)", tint: "bg-warning/10 text-warning", icon: Activity },
  Low: { color: "var(--success)", tint: "bg-success/10 text-success", icon: ShieldCheck },
};

function ScoringDonut({ data }: { data: Array<{ band: string; count: number }> }) {
  const size = 168;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = 3;
  const total = data.reduce((s, d) => s + d.count, 0);

  let prior = 0;
  const segments = data.map((d) => {
    const frac = total > 0 ? d.count / total : 0;
    const len = Math.max(0, frac * circ - gap);
    const offset = (prior / (total || 1)) * circ;
    prior += d.count;
    return {
      band: d.band,
      len,
      offset,
      color: BAND_META[d.band]?.color ?? "var(--chart-1)",
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Scoring distribution: ${total} scored needs`}
      className="shrink-0"
    >
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
          opacity={0.5}
        />
        {total > 0 &&
          segments.map((s) => (
            <circle
              key={s.band}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${s.len} ${circ - s.len}`}
              strokeDashoffset={-s.offset}
            />
          ))}
      </g>
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="fill-foreground text-3xl font-bold tabular-nums"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        className="fill-muted-foreground text-[11px]"
      >
        scored
      </text>
    </svg>
  );
}

function ScoringDistribution({
  data,
  needCount,
  t,
}: {
  data: Array<{ band: string; count: number }>;
  needCount: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const bands = ["High", "Medium", "Low"].map(
    (band) => data.find((d) => d.band === band) ?? { band, count: 0 },
  );
  const total = bands.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col space-y-1 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-foreground text-sm font-semibold">{t("scoringHeading")}</h3>
          <p className="text-muted-foreground text-xs">
            {t("scoringSubtitle", { scored: total, total: needCount })}
          </p>
        </div>

        {total === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <BarChart3 className="size-8 opacity-40" />
            <p className="text-sm font-medium">{t("scoringEmpty")}</p>
            <p className="text-xs">{t("scoringEmptyHint")}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 pt-4">
            <ScoringDonut data={bands} />
            <ul className="w-full space-y-4">
              {bands.map((b) => {
                const meta = BAND_META[b.band];
                const Icon = meta.icon;
                const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                return (
                  <li key={b.band} className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`${meta.tint} flex size-7 items-center justify-center rounded-md`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="text-foreground flex-1 text-sm font-medium">
                        {t(`band.${b.band}`)}
                      </span>
                      <span className="text-foreground text-sm font-semibold tabular-nums">
                        {b.count}
                      </span>
                      <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: meta.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Executive summary bits ───────────────────────────────────────────────────

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
  const scoredCount = kpis.scoringDistribution.reduce((s, d) => s + d.count, 0);
  const highPriorityCount =
    kpis.scoringDistribution.find((d) => d.band === "High")?.count ?? 0;

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
          label={t("kpi.highPriority")}
          value={String(highPriorityCount)}
          icon={<AlertTriangle className="size-5" />}
        />
        <Kpi
          label={t("kpi.scored")}
          value={String(scoredCount)}
          icon={<GaugeIcon className="size-5" />}
        />
        <Kpi
          label={t("kpi.studies")}
          value={String(scope.studyCount)}
          icon={<ListChecks className="size-5" />}
        />
      </div>

      {/* Quick actions (left) + scoring distribution (right) — equal height */}
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickNav t={t} />
        <ScoringDistribution
          data={kpis.scoringDistribution}
          needCount={kpis.needCount}
          t={t}
        />
      </div>

      {/* Executive summary */}
      <Card>
        <CardContent className="space-y-6 p-6">
          <h3 className="text-foreground text-sm font-semibold">{t("execHeading")}</h3>

          <section className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("topPriorities")}
            </p>
            {exec.topPriorities.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("topPrioritiesEmpty")}</p>
            ) : (
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
                          {Math.round(p.severityScore)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.entity ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
              {exec.anomalies.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("anomaliesEmpty")}</p>
              ) : (
                <ul className="space-y-2">
                  {exec.anomalies.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {a.severity === "info" ? (
                        <Info
                          className={`${ANOMALY_STYLE[a.severity]} size-4 shrink-0`}
                        />
                      ) : (
                        <AlertTriangle
                          className={`${ANOMALY_STYLE[a.severity]} size-4 shrink-0`}
                        />
                      )}
                      <span className="text-foreground">{a.note}</span>
                    </li>
                  ))}
                </ul>
              )}
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
