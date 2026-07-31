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
import {
  BarChart,
  DonutChart,
  Gauge,
  GroupedBarChart,
  RadarChart,
  StatTiles,
} from "./report-charts";

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
function scalar(v: unknown, key?: string): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  // Performance Score in the Severity Analysis table is a computed ratio
  // (e.g. 76.28999999999999) — 2 decimal places, same spirit as the whole-
  // number rounding already applied to severity/priority scores elsewhere.
  if (key === "performanceScore" && typeof v === "number") {
    return (Math.round(v * 100) / 100).toFixed(2);
  }
  // Fold ISO datetimes to a compact, readable stamp — the Approval Trail
  // section (officerConfirmedAt/reviewedAt) was showing raw
  // "2026-07-22T10:30:00.000Z" instead of an actual date/time.
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
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

// Explicit column spec — lets a caller fix the column order, relabel, and
// combine fields (e.g. Confidence = band + %). Omitted → auto-derive every key.
type ColSpec = { key: string; label?: string; format?: (r: Dict) => string };

function DataTable({ rows, columns }: { rows: Dict[]; columns?: ColSpec[] }) {
  const cols: ColSpec[] =
    columns ??
    Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).map((key) => ({ key }));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c.key} className="whitespace-nowrap">
                {c.label ?? label(c.key)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c.key} className="text-sm whitespace-nowrap">
                  {c.format ? c.format(r) : scalar(r[c.key], c.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Explicit column set for the domain table — includes the methodology code and
// KPI count, and folds the quantitative % into the Confidence column.
const DOMAIN_COLUMNS: ColSpec[] = [
  { key: "name", label: "Domain" },
  { key: "domainCode", label: "Code" },
  { key: "severityScore", label: "Severity" },
  { key: "performanceScore", label: "Performance" },
  { key: "weight", label: "Weight" },
  { key: "kpiCount", label: "KPIs" },
  {
    key: "confidence",
    label: "Confidence",
    format: (r) =>
      typeof r.confidencePct === "number"
        ? `${scalar(r.confidence)} (${r.confidencePct}%)`
        : scalar(r.confidence),
  },
  { key: "isCriticalDomain", label: "Critical" },
];

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
  // KEEP IN SYNC with the identical predicate in the backend doc builder
  // (Project-RIO-Backend/src/modules/reports/report-doc.ts#buildReportDoc).
  // If the two drift, a report renders rich in one place and as a flat
  // key/value dump in the other.
  const isCore =
    isObj(c.header) &&
    (isObj(c.severity) ||
      isObj(c.coverage) ||
      isObj(c.dashboard) ||
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
    !!severity ||
    !!domains ||
    isObjArray(c.regions) ||
    isObjArray(c.topPriorities) ||
    // Executive report may have an empty topPriorities list — treat a report
    // carrying Response Quality as a needs report so the demographics
    // placeholder still renders, consistent with the other reports.
    isObj(c.responseQuality);
  const needsIndex = severity ? num(severity.overallVillageNeedsIndex) : null;
  const priorityStatus = priority ? scalar(priority.priorityStatus) : "";

  const sections: Array<{ title: string; node: ReactNode }> = [];

  // 1 — Executive Summary + headline metrics
  if (ai?.executiveSummary || needsIndex !== null || priority) {
    sections.push({
      title: t("executiveSummary"),
      node: (
        <div className="space-y-4">
          {ai?.executiveSummary ? (
            <p className="text-foreground text-sm leading-relaxed">
              {scalar(ai.executiveSummary)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-5">
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
                  {num(priority.villagePriorityScore) !== null
                    ? Math.round(num(priority.villagePriorityScore)!)
                    : scalar(priority.villagePriorityScore)}
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

  // Survey identity (RPT01/RPT15) — which survey, under which need. Without it
  // a survey-scoped report is indistinguishable from its sibling.
  if (isObj(c.survey)) {
    const sv = c.survey as Dict;
    sections.push({
      title: t("survey"),
      node: (
        <KeyValues
          obj={{
            surveyTitle: sv.surveyTitle,
            surveyStatus: sv.surveyStatus,
            needStatement: sv.needStatement,
            villageName: sv.villageName,
            assessmentCycle: sv.assessmentCycle,
            assessmentPeriod: sv.assessmentPeriod,
            methodologyVersion: sv.methodologyVersion,
          }}
        />
      ),
    });
  }

  // Coverage tiles — how much data this report actually rests on.
  if (isObj(c.coverage)) {
    const cv = c.coverage as Dict;
    const submitted = num(cv.responsesSubmitted) ?? 0;
    const valid = num(cv.responsesValid) ?? 0;
    sections.push({
      title: t("coverage"),
      node: (
        <StatTiles
          items={[
            {
              label: t("cov.needs"),
              value: scalar(cv.needsInStudy),
              sub: `${scalar(cv.needsCoveredByThisSurvey)} ${t("cov.coveredHere")}`,
            },
            { label: t("cov.surveys"), value: scalar(cv.surveysInStudy) },
            {
              label: t("cov.villages"),
              value: scalar(cv.villagesCovered),
              sub: `${scalar(cv.governoratesCovered)} ${t("cov.governorates")}`,
            },
            {
              label: t("cov.questions"),
              value: scalar(cv.surveyQuestionsTotal),
              sub: `${scalar(cv.surveyQuestionsFromBank)} / ${scalar(cv.surveyQuestionsCustom)} ${t("cov.bankCustom")}`,
            },
            {
              label: t("cov.links"),
              value: scalar(cv.publicSurveyLinks),
              sub: `${scalar(cv.activeSurveyLinks)} ${t("cov.active")}`,
            },
            {
              label: t("cov.submitted"),
              value: scalar(cv.responsesSubmitted),
              sub: scalar(cv.assessmentPeriod),
            },
            {
              label: t("cov.valid"),
              value: scalar(cv.responsesValid),
              sub: `${submitted > 0 ? Math.round((valid / submitted) * 100) : 0}% ${t("cov.ofSubmitted")}`,
            },
            {
              label: t("cov.excluded"),
              value: scalar(cv.responsesExcluded),
              sub: `${scalar(cv.dontKnowRatePct)}% ${t("cov.dontKnow")}`,
            },
            {
              label: t("cov.documents"),
              value: scalar(cv.evidenceFilesTotal),
              sub: `${scalar(cv.evidenceIncludedInReport)} ${t("cov.included")}`,
            },
            { label: t("cov.domainsScored"), value: scalar(cv.domainsScored) },
            { label: t("cov.kpisScored"), value: scalar(cv.kpisScored) },
            {
              label: t("cov.flagged"),
              value: String(
                (num(cv.duplicateResponses) ?? 0) + (num(cv.lowConfidenceResponses) ?? 0),
              ),
              sub: `${scalar(cv.duplicateResponses)} / ${scalar(cv.lowConfidenceResponses)} ${t("cov.dupLowConf")}`,
            },
          ]}
        />
      ),
    });
  }

  // Organisation portfolio (RPT15) — volumes only, never performance.
  if (isObj(c.portfolio)) {
    const p = c.portfolio as Dict;
    sections.push({
      title: t("portfolio"),
      node: (
        <StatTiles
          items={[
            { label: t("port.studies"), value: scalar(p.studiesTotal) },
            { label: t("port.needs"), value: scalar(p.needsTotal) },
            { label: t("port.surveys"), value: scalar(p.surveysTotal) },
            { label: t("port.links"), value: scalar(p.publicLinksTotal) },
            {
              label: t("port.responses"),
              value: scalar(p.responsesTotal),
              sub: `${t("port.thisSurvey")} ${scalar(p.thisSurveyShareOfResponsesPct)}%`,
            },
            { label: t("port.documents"), value: scalar(p.evidenceFilesTotal) },
            { label: t("port.reports"), value: scalar(p.reportsTotal) },
            { label: t("port.sharing"), value: scalar(p.sharingRequestsTotal) },
            {
              label: t("port.villages"),
              value: scalar(p.villagesCovered),
              sub: `${scalar(p.governoratesCovered)} ${t("cov.governorates")}`,
            },
          ]}
        />
      ),
    });
  }

  // Structured scope — Region / Governorate (Executive report), shown up front.
  if (isObj(c.scope)) {
    const scope = c.scope as Dict;
    sections.push({
      title: t("regionGovernorate"),
      node: (
        <KeyValues obj={{ coverage: scope.villages, governorate: scope.governorate }} />
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
            // confidencePct is folded into the Overall Confidence tile below.
            .filter(([k, v]) => k !== "confidencePct" && !isObj(v) && !Array.isArray(v))
            .map(([k, v]) => {
              const pct = (c.responseQuality as Dict).confidencePct;
              if (k === "overallConfidence" && typeof pct === "number") {
                return { label: label(k), value: `${scalar(v)} (${pct}%)` };
              }
              return {
                label: label(k),
                value: k.toLowerCase().includes("rate") ? `${scalar(v)}%` : scalar(v),
              };
            })}
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
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
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
          <DataTable rows={domains} columns={DOMAIN_COLUMNS} />
          {domains.some((d) => typeof d.trendNote === "string" && d.trendNote) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("trendNotes")}
              </p>
              <div className="divide-border divide-y">
                {domains
                  .filter((d) => typeof d.trendNote === "string" && d.trendNote)
                  .map((d, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-4 py-2 text-sm"
                    >
                      <span className="text-muted-foreground">{scalar(d.name)}</span>
                      <span className="text-foreground text-right">
                        {scalar(d.trendNote)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
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

  // Data-collection funnel + questionnaire weighting, side by side.
  if (isObjArray(c.responseFunnel) || isObjArray(c.questionCoverage)) {
    const funnel = isObjArray(c.responseFunnel)
      ? toBars(c.responseFunnel, "stage", "count")
      : null;
    const qcov = isObjArray(c.questionCoverage)
      ? toBars(c.questionCoverage, "domain", "count")
      : null;
    sections.push({
      title: t("dataCollection"),
      node: (
        <div className="grid gap-4 lg:grid-cols-2">
          {funnel ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">{t("funnel")}</p>
              <BarChart bars={funnel} max={Math.max(1, ...funnel.map((b) => b.value))} />
            </div>
          ) : null}
          {qcov ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("questionsPerDomain")}
              </p>
              <BarChart bars={qcov} max={Math.max(1, ...qcov.map((b) => b.value))} />
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // ── RPT15's dashboard half ──
  if (isObj(c.dashboard)) {
    const d = c.dashboard as Dict;
    const kpis = isObj(d.kpis) ? d.kpis : null;
    const slaPct = kpis ? num(kpis.slaCompliancePct) : null;
    const dist = isObjArray(d.scoringDistribution)
      ? toBars(d.scoringDistribution, "band", "count")
      : null;

    sections.push({
      title: t("orgDashboard"),
      node: (
        <div className="space-y-4">
          {/* The two halves were captured at different moments and must never
              read as simultaneous. */}
          <p className="text-muted-foreground text-xs">
            {t("dashboardCapturedAt")}: {scalar(d.capturedAt)}
          </p>
          <div className="flex flex-wrap items-start gap-6">
            {slaPct !== null ? (
              <Gauge value={slaPct} max={100} label={t("slaCompliance")} sub="%" />
            ) : null}
            {kpis ? (
              <div className="min-w-56 flex-1">
                <KeyValues obj={kpis} />
              </div>
            ) : null}
          </div>
          {dist ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("orgScoringDistribution")}
              </p>
              <BarChart bars={dist} max={Math.max(1, ...dist.map((b) => b.value))} />
            </div>
          ) : null}
          {isObjArray(d.topPriorities) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("orgTopPriorities")}
              </p>
              <DataTable rows={d.topPriorities} />
            </div>
          ) : null}
          {Array.isArray(d.anomalies) && d.anomalies.length > 0 ? (
            <ul className="text-foreground list-disc space-y-1 pl-5 text-sm">
              {d.anomalies.map((a, i) => (
                <li key={i}>{scalar(a)}</li>
              ))}
            </ul>
          ) : null}
          {isObjArray(d.reviewerNotes) ? <DataTable rows={d.reviewerNotes} /> : null}
        </div>
      ),
    });
  }

  // The reconciliation band — paired bars, then the exact figures beneath.
  if (isObjArray(c.comparison)) {
    const rows = c.comparison;
    sections.push({
      title: t("comparison"),
      node: (
        <div className="space-y-4">
          <GroupedBarChart
            groups={rows.map((r) => scalar(r.metric))}
            max={100}
            series={[
              {
                name: t("thisSurvey"),
                values: rows.map((r) => num(r.surveyValue) ?? 0),
                color: "var(--chart-1)",
              },
              {
                name: t("organisation"),
                values: rows.map((r) => num(r.orgAverage) ?? 0),
                color: "var(--chart-2)",
              },
            ]}
          />
          <DataTable rows={rows} />
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
          <div className="grid gap-4 sm:grid-cols-2">
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

  // First-class Data Quality and Trend notes (promoted out of the AI Summary —
  // currently the region report) rendered as their own distinct sections.
  if (typeof c.dataQualityNote === "string" && c.dataQualityNote) {
    sections.push({
      title: t("dataQualityNote"),
      node: (
        <p className="text-foreground text-sm leading-relaxed">
          {scalar(c.dataQualityNote)}
        </p>
      ),
    });
  }
  if (typeof c.trendNote === "string" && c.trendNote) {
    sections.push({
      title: t("trendNote"),
      node: (
        <p className="text-foreground text-sm leading-relaxed">{scalar(c.trendNote)}</p>
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
          // Prefer the resolved display name (report.*Name, from the API —
          // see toReport/namesFor on the backend) over a raw user id; `approval`
          // (from report content, when present) doesn't carry names at all.
          officerConfirmedBy:
            report.officerConfirmedByName ??
            approval?.officerConfirmedBy ??
            report.officerConfirmedBy,
          officerConfirmedAt: approval?.officerConfirmedAt ?? report.officerConfirmedAt,
          reviewerApprovedBy:
            report.reviewedByName ?? approval?.reviewerApprovedBy ?? report.reviewedBy,
          // Reviewer's role (Approver vs Supervisor) — only when known.
          ...(report.reviewedByRole ? { reviewerRole: report.reviewedByRole } : {}),
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
    <div className="mx-auto">
      <div className="bg-card border-border overflow-hidden rounded-xl border shadow-sm">
        {/* Cover / masthead */}
        <div className="border-t-4 border-t-[var(--primary)] p-5 sm:p-6">
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
            <section key={s.title} className="space-y-3 p-5 sm:p-6">
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
