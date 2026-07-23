"use client";

import { FileText, Sparkles, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { flattenReportContent } from "@/lib/report-content-flatten";
import type { Report } from "@/services/reports/reports.types";
import { BarChart, DonutChart, Gauge, RadarChart, StatTiles } from "./report-charts";

type Dict = Record<string, unknown>;

function isObj(v: unknown): v is Dict {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isObjArray(v: unknown): v is Dict[] {
  return Array.isArray(v) && v.length > 0 && isObj(v[0]);
}
function label(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}
function scalar(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function toBars(rows: Dict[], labelKey: string, valueKey: string) {
  return rows
    .filter((r) => typeof r[valueKey] === "number")
    .map((r) => ({ label: scalar(r[labelKey]), value: r[valueKey] as number }));
}
function priorityColor(status: string): string {
  switch (status.toUpperCase()) {
    case "HIGH":
      return "var(--chart-2)";
    case "MEDIUM":
      return "var(--chart-4)";
    case "LOW":
      return "var(--chart-3)";
    default:
      return "var(--chart-1)";
  }
}

const GENDER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)"];
const RURAL_COLORS = ["var(--chart-3)", "var(--chart-4)"];

function KeyValues({ obj, exclude = [] }: { obj: Dict; exclude?: string[] }) {
  const rows = Object.entries(obj).filter(
    ([k, v]) => !exclude.includes(k) && !isObj(v) && !Array.isArray(v),
  );
  return (
    <div className="divide-border divide-y">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 py-2 text-sm">
          <span className="text-muted-foreground">{label(k)}</span>
          <span className="text-foreground text-right font-medium">{scalar(v)}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows }: { rows: Dict[] }) {
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="whitespace-nowrap">
                {label(c)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c} className="text-sm whitespace-nowrap">
                  {scalar(r[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Card-wrapped section — used only for the generic (placeholder) fallback. */
function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

export function ReportContentView({ report }: { report: Report }) {
  const t = useTranslations("app.reports.content");
  const c = report.content as Dict;
  const isCore =
    isObj(c.header) &&
    (isObj(c.severity) ||
      isObjArray(c.domains) ||
      isObjArray(c.regions) ||
      isObjArray(c.topPriorities) ||
      isObj(c.kpis) ||
      isObjArray(c.scoringDistribution) ||
      isObjArray(c.requests));

  if (!isCore) {
    const flat = flattenReportContent(c);
    return (
      <div className="space-y-6">
        {flat.narrative ? (
          <Section icon={<Sparkles className="size-4" />} title={t("executiveSummary")}>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
              {flat.narrative}
            </p>
          </Section>
        ) : null}
        {flat.summaryRows.length > 0 ? (
          <Section icon={<FileText className="size-4" />} title={t("summary")}>
            <div className="divide-border divide-y">
              {flat.summaryRows.map((row) => (
                <div
                  key={row.field}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{row.field}</span>
                  <span className="text-foreground font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
        {flat.tables.map((tbl) => (
          <Section key={tbl.name} icon={<Table2 className="size-4" />} title={tbl.name}>
            <DataTable rows={tbl.rows as Dict[]} />
          </Section>
        ))}
      </div>
    );
  }

  // ── Core report: rendered as a document (cover + numbered sections). ──
  const header = isObj(c.header) ? c.header : {};
  const village = isObj(c.village) ? c.village : null;
  const severity = isObj(c.severity) ? c.severity : null;
  const domains =
    severity && isObjArray(severity.domains)
      ? severity.domains
      : isObjArray(c.domains)
        ? c.domains
        : null;
  const priority = isObj(c.priority) ? c.priority : null;
  const ai = isObj(c.aiSummary) ? c.aiSummary : null;
  const approval = isObj(c.approval) ? c.approval : null;
  const demo = isObj(c.demographics) ? c.demographics : null;
  const isNeedsReport =
    !!severity || !!domains || isObjArray(c.regions) || isObjArray(c.topPriorities);
  const needsIndex = severity ? num(severity.overallVillageNeedsIndex) : null;
  const priorityStatus = priority ? scalar(priority.priorityStatus) : "";

  const sections: Array<{ title: string; node: ReactNode }> = [];

  // 1 — Executive Summary + headline metrics
  if (ai?.executiveSummary || needsIndex !== null || priority) {
    sections.push({
      title: t("executiveSummary"),
      node: (
        <div className="space-y-5">
          {ai?.executiveSummary ? (
            <p className="text-foreground text-sm leading-relaxed">
              {scalar(ai.executiveSummary)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-6">
            {needsIndex !== null ? (
              <Gauge
                value={needsIndex}
                max={100}
                label={t("needsIndex")}
                sub={scalar(severity?.label)}
              />
            ) : null}
            {priority ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">{t("priorityScore")}</p>
                <p className="text-foreground text-3xl font-bold tabular-nums">
                  {scalar(priority.villagePriorityScore)}
                </p>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ background: priorityColor(priorityStatus) }}
                >
                  {priorityStatus} {t("priority")}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ),
    });
  }

  // 2 — Response Quality (stat tiles)
  if (isObj(c.responseQuality)) {
    sections.push({
      title: t("responseQuality"),
      node: (
        <StatTiles
          items={Object.entries(c.responseQuality)
            .filter(([, v]) => !isObj(v) && !Array.isArray(v))
            .map(([k, v]) => ({
              label: label(k),
              value: k.toLowerCase().includes("rate") ? `${scalar(v)}%` : scalar(v),
            }))}
        />
      ),
    });
  }

  // 3 — Severity Analysis (radar + ranked bars + table)
  if (domains) {
    const severBars = toBars(domains, "name", "severityScore");
    const hasPerf = domains.some((d) => typeof d.performanceScore === "number");
    sections.push({
      title: t("severityAnalysis"),
      node: (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">{t("profile")}</p>
              <RadarChart
                axes={domains.map((d) => scalar(d.name))}
                max={100}
                series={[
                  {
                    name: t("severityLabel"),
                    values: domains.map((d) => num(d.severityScore) ?? 0),
                    color: "var(--chart-1)",
                  },
                  ...(hasPerf
                    ? [
                        {
                          name: t("performanceLabel"),
                          values: domains.map((d) => num(d.performanceScore) ?? 0),
                          color: "var(--chart-2)",
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">{t("ranked")}</p>
              <BarChart bars={severBars} max={100} />
            </div>
          </div>
          <DataTable rows={domains} />
        </div>
      ),
    });
  }

  // 4 — Priority Assessment
  if (priority) {
    sections.push({
      title: t("priority"),
      node: (
        <div className="space-y-3">
          <KeyValues obj={priority} exclude={["overrideReason"]} />
          {priority.overrideApplied && priority.overrideReason ? (
            <div
              className="border-l-2 py-2 pl-3 text-sm"
              style={{ borderColor: priorityColor(priorityStatus) }}
            >
              <p className="text-muted-foreground text-xs font-medium">{t("override")}</p>
              <p className="text-foreground">{scalar(priority.overrideReason)}</p>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // Collective KPIs / scoring distribution (RPT02)
  if (isObj(c.kpis)) {
    sections.push({ title: t("kpis"), node: <KeyValues obj={c.kpis} /> });
  }
  if (isObjArray(c.scoringDistribution)) {
    const max = Math.max(1, ...c.scoringDistribution.map((r) => num(r.count) ?? 0));
    sections.push({
      title: t("scoringDistribution"),
      node: <BarChart bars={toBars(c.scoringDistribution, "band", "count")} max={max} />,
    });
  }

  // Top KPIs / priorities / regions
  if (isObjArray(c.topKpis))
    sections.push({ title: t("topKpis"), node: <DataTable rows={c.topKpis} /> });
  if (isObjArray(c.topPriorities))
    sections.push({
      title: t("topPriorities"),
      node: <DataTable rows={c.topPriorities} />,
    });
  if (isObjArray(c.regions))
    sections.push({ title: t("regions"), node: <DataTable rows={c.regions} /> });

  // Sharing status (RPT12)
  if (isObj(c.summary) && isObjArray(c.requests)) {
    sections.push({ title: t("sharingSummary"), node: <KeyValues obj={c.summary} /> });
  }
  if (isObjArray(c.requests))
    sections.push({ title: t("sharingRequests"), node: <DataTable rows={c.requests} /> });

  // Qualitative evidence
  if (isObjArray(c.qualitativeEvidence))
    sections.push({
      title: t("evidence"),
      node: <DataTable rows={c.qualitativeEvidence} />,
    });

  // Demographics (pies)
  if (isNeedsReport) {
    const gender =
      demo && isObjArray(demo.gender) ? toBars(demo.gender, "label", "count") : null;
    const rural =
      demo && isObjArray(demo.rural) ? toBars(demo.rural, "label", "count") : null;
    sections.push({
      title: t("demographics"),
      node:
        gender || rural ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {gender ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">{t("gender")}</p>
                <DonutChart
                  data={gender}
                  colorVars={GENDER_COLORS}
                  centerLabel={t("respondents")}
                />
              </div>
            ) : null}
            {rural ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">{t("rural")}</p>
                <DonutChart
                  data={rural}
                  colorVars={RURAL_COLORS}
                  centerLabel={t("respondents")}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("notAvailable")}</p>
        ),
    });
  }

  // Analysis & recommendations
  if (
    ai &&
    (ai.keyFindings ||
      ai.dataQualityNote ||
      ai.trendNote ||
      Array.isArray(ai.recommendations))
  ) {
    sections.push({
      title: t("analysis"),
      node: (
        <div className="space-y-3">
          {(["keyFindings", "dataQualityNote", "trendNote"] as const).map((k) =>
            ai[k] ? (
              <div key={k}>
                <p className="text-muted-foreground text-xs font-medium">{label(k)}</p>
                <p className="text-foreground text-sm leading-relaxed">{scalar(ai[k])}</p>
              </div>
            ) : null,
          )}
          {Array.isArray(ai.recommendations) && ai.recommendations.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {t("recommendations")}
              </p>
              <ul className="text-foreground mt-1 list-disc space-y-1 pl-5 text-sm">
                {ai.recommendations.map((r, i) => (
                  <li key={i}>{scalar(r)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // Anomalies + reviewer notes
  if (Array.isArray(c.anomalies) && c.anomalies.length > 0) {
    sections.push({
      title: t("anomalies"),
      node: (
        <ul className="text-foreground list-disc space-y-1 pl-5 text-sm">
          {c.anomalies.map((a, i) => (
            <li key={i}>{scalar(a)}</li>
          ))}
        </ul>
      ),
    });
  }
  if (c.reviewerNotes) {
    sections.push({
      title: t("reviewerNotes"),
      node: <p className="text-foreground text-sm">{scalar(c.reviewerNotes)}</p>,
    });
  }

  // Approval trail
  sections.push({
    title: t("approval"),
    node: (
      <KeyValues
        obj={{
          officerConfirmedBy: approval?.officerConfirmedBy ?? report.officerConfirmedBy,
          officerConfirmedAt: approval?.officerConfirmedAt ?? report.officerConfirmedAt,
          reviewerApprovedBy: approval?.reviewerApprovedBy ?? report.reviewedBy,
          reviewerApprovedAt: approval?.reviewerApprovedAt ?? report.reviewedAt,
        }}
      />
    ),
  });

  const meta: Array<{ k: string; v: string }> = [];
  if (village) meta.push({ k: t("village"), v: scalar(village.name) });
  if (village?.assessmentPeriod)
    meta.push({ k: t("period"), v: scalar(village.assessmentPeriod) });
  if (village?.assessmentCycle)
    meta.push({ k: t("cycle"), v: scalar(village.assessmentCycle) });
  if (header.methodologyVersion)
    meta.push({ k: t("methodology"), v: scalar(header.methodologyVersion) });
  if (header.entityName) meta.push({ k: t("entity"), v: scalar(header.entityName) });
  if (header.reportGeneratedAt)
    meta.push({
      k: t("generated"),
      v: new Date(scalar(header.reportGeneratedAt)).toLocaleDateString(),
    });
  meta.push({ k: t("reportId"), v: report.id.slice(0, 8).toUpperCase() });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
        {/* Cover / masthead */}
        <div className="border-t-4 border-t-[var(--primary)] p-6 sm:p-8">
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">
            {t("reportLabel")}
          </p>
          <h1 className="text-foreground mt-1 text-2xl font-bold">
            {scalar(header.studyName)}
          </h1>
          {village ? (
            <p className="text-muted-foreground mt-0.5 text-sm">{scalar(village.name)}</p>
          ) : null}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {meta.map((m) => (
              <div key={m.k}>
                <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  {m.k}
                </dt>
                <dd className="text-foreground text-sm font-medium">{m.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Numbered sections */}
        <div className="divide-border divide-y">
          {sections.map((s, i) => (
            <section key={s.title} className="space-y-4 p-6 sm:p-8">
              <h2 className="text-foreground flex items-center gap-2.5 text-base font-semibold">
                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded text-xs font-bold">
                  {i + 1}
                </span>
                {s.title}
              </h2>
              {s.node}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
