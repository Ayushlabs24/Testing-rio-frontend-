"use client";

import { ArrowRight, FileText, Sparkles, Table2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { localizeReportText } from "@/lib/report-narrative-i18n";
import type { AppLocale } from "@/i18n/routing";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { RegionMap } from "@/components/features/ncnp-report/region-map";
import { StatusDonut } from "@/components/features/ncnp-report/status-donut";
import { NamedBarList } from "@/components/features/ncnp-report/named-bar-list";
import { TwoStateBar } from "@/components/features/ncnp-report/two-state-bar";
import type { NcnpNamedBreakdown } from "@/services/ncnp-report/ncnp-report.types";
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

// Module-level, not inline literals: RegionMap rebuilds every marker when its
// `unitLabel` prop is a fresh array each render (see its own comment).
const DOCUMENT_UNIT_LABEL = ["document", "documents"] as const;
const DATA_POINT_UNIT_LABEL = ["data point", "data points"] as const;

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
                <TableCell
                  key={c.key}
                  dir="auto"
                  className="text-sm break-words whitespace-normal"
                >
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

// Explicit column set for the domain table. The confidence BAND and the
// valid-response RATE are separate columns: folding them into "STANDARD (90%)"
// read as "90% confident", which is a claim neither number makes.
const DOMAIN_COLUMNS: ColSpec[] = [
  { key: "name", label: "Domain" },
  { key: "domainCode", label: "Code" },
  // Severity is ALWAYS shown. Null renders "—", never 0.
  { key: "severityScore", label: "Severity" },
  { key: "performanceScore", label: "Performance" },
  { key: "weight", label: "Weight" },
  { key: "kpiCount", label: "KPIs defined" },
  { key: "confidence", label: "Confidence" },
  { key: "validResponseRatePct", label: "Valid %" },
  { key: "isCriticalDomain", label: "Critical" },
];

// One row per Unified Need Record — the client's domain / sub-domain /
// indicator classification, with severity always visible.
const NEED_RECORD_COLUMNS: ColSpec[] = [
  { key: "domain", label: "Domain" },
  { key: "subDomain", label: "Sub-domain" },
  { key: "indicatorName", label: "Indicator" },
  { key: "severityScore", label: "Severity" },
  { key: "severityBand", label: "Band" },
  { key: "confidence", label: "Confidence" },
  { key: "equityFlag", label: "Equity" },
  { key: "validResponseCount", label: "Responses" },
  // Why this row carries no severity, or why its equity check could not run —
  // a blank Equity "No" would otherwise read as "checked, no inequity found".
  { key: "notMeasuredReason", label: "Notes", format: needNotes },
];

// Summary status as a reserved status colour PLUS its written label — the
// badge never communicates state by colour alone. Tinted backgrounds pair with
// `text-foreground`, not the matching `*-foreground` token: those are
// near-white/near-black steps meant for a solid fill and vanish on a 10% tint.
function EvidenceStatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    OFFICER_CONFIRMED: "border-success/40 bg-success/10",
    DRAFT: "border-warning/40 bg-warning/10",
    SUPERSEDED: "border-border bg-muted/40",
    NO_SUMMARY: "border-destructive/40 bg-destructive/10",
  };
  return (
    <span
      className={`text-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        tone[status] ?? "border-border bg-muted/40"
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// Response Quality, in reading order with explicit labels. The confidence BAND,
// the REASON for it and the valid-response RATE are three distinct facts; the
// auto-derived labels turned `dontKnowBand` into "Dont Know Band" and printed
// the rate without a unit.
function ResponseQualityBlock({ rq }: { rq: Dict }) {
  const pct = (v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}%` : scalar(v));
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [
    { label: "Overall confidence", value: scalar(rq.overallConfidence) },
    { label: "Responses submitted", value: scalar(rq.submittedResponses) },
    { label: "Valid responses", value: scalar(rq.validResponses) },
    { label: "Valid-response rate", value: `${scalar(rq.validResponseRatePct)}%` },
    { label: "Don't-know rate", value: pct(rq.dontKnowRate) },
    { label: "Don't-know band", value: scalar(rq.dontKnowBand) },
  ];
  return (
    <div className="space-y-3">
      <StatTiles items={rows} />
      {typeof rq.confidenceReason === "string" && rq.confidenceReason ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium">Why this band</p>
          <p className="text-foreground text-sm leading-relaxed">{rq.confidenceReason}</p>
        </div>
      ) : null}
    </div>
  );
}

function needNotes(r: Dict): string {
  if (typeof r.notMeasuredReason === "string" && r.notMeasuredReason)
    return r.notMeasuredReason;
  const eq = r.equityDetail;
  if (isObj(eq) && eq.evaluable === false && typeof eq.reason === "string") {
    return `Equity not evaluable: ${eq.reason}`;
  }
  return "";
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
  const locale = useLocale() as AppLocale;
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
      isObjArray(c.requests) ||
      isObj(c.evidenceSection) ||
      isObj(c.geography));

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

  // Evidence-backed reports (RPT16 / RPT17) only. Gated on `evidenceSection`,
  // which no other report type carries, so the survey-scoped and dashboard
  // reports are untouched by everything keyed off this.
  const evidence = isObj(c.evidenceSection) ? (c.evidenceSection as Dict) : null;
  const evidenceDocs =
    evidence && isObjArray(evidence.documents) ? (evidence.documents as Dict[]) : [];

  // 0 — Report basis. Renders first so the SURVEY-ONLY / QUANTITATIVE basis is
  // established before any number is read (the client's "clearly marked
  // quantitative" requirement).
  if (isObj(c.reportMeta)) {
    const m = c.reportMeta as Dict;
    sections.push({
      title: t("reportBasis"),
      node: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {t("badge.surveyOnly")}
            </span>
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {t("badge.quantitative")}
            </span>
          </div>
          <KeyValues
            obj={{
              reportType: `${scalar(m.reportType)} — ${scalar(m.reportTypeName)}`,
              sourceBasis: t("basis.sourceBasis"),
              evidenceType: t("basis.evidenceType"),
            }}
          />
        </div>
      ),
    });
  }

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
                scaleNote={t("scale.severity")}
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
    // KEEP IN SYNC with coverageStats in the backend's report-doc.ts: a
    // SURVEY-ONLY report drops the documents tile, which would otherwise
    // contradict the Report Basis line above it.
    const surveyOnly =
      isObj(c.reportMeta) && (c.reportMeta as Dict).sourceBasis === "SURVEY_ONLY";
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
            ...(surveyOnly
              ? []
              : [
                  {
                    label: t("cov.documents"),
                    value: scalar(cv.evidenceFilesTotal),
                    sub: `${scalar(cv.evidenceIncludedInReport)} ${t("cov.included")}`,
                  },
                ]),
            { label: t("cov.domainsScored"), value: scalar(cv.domainsScored) },
            {
              label: t("cov.kpisScored"),
              value: scalar(cv.kpisScored),
              // Attempted-but-unmeasurable KPIs counted separately — folding
              // them into "scored" hid them entirely.
              sub: `${scalar(cv.kpisAttempted)} ${t("cov.asked")} · ${scalar(cv.kpisNotMeasurable)} ${t("cov.notMeasurable")}`,
            },
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

  // Geographic scope — one canonical resolver feeds header, narrative and
  // coverage, so they cannot name different places.
  if (isObj(c.unitGeo)) {
    const g = c.unitGeo as Dict;
    sections.push({
      title: t("geographicScope"),
      node: (
        <KeyValues
          obj={{
            scope: g.scopeLabel,
            region: g.regionName,
            governorates: Array.isArray(g.governorateNames)
              ? g.governorateNames.join(", ")
              : "—",
            villages: Array.isArray(g.villages) ? g.villages.join(", ") : "—",
          }}
        />
      ),
    });
  }

  // 2 — Executive Summary: counts, then EVERY methodology domain (assessed or
  // not), then the top three needs.
  if (isObj(c.executiveSummary)) {
    const es = c.executiveSummary as Dict;
    sections.push({
      title: t("summaryOfNeeds"),
      node: (
        <div className="space-y-4">
          <StatTiles
            items={[
              {
                label: t("es.needsExtracted"),
                value: scalar(es.totalNeedsExtracted),
                sub: `${scalar(es.measuredCount)} ${t("es.measured")} · ${scalar(es.notMeasurableCount)} ${t("es.notMeasurable")}`,
              },
              { label: t("es.quantitative"), value: scalar(es.quantitativeCount) },
              { label: t("es.qualitative"), value: scalar(es.qualitativeCount) },
              {
                label: t("es.domainsAssessed"),
                value: scalar(es.domainsAssessed),
                sub: `${t("es.of")} ${scalar(es.domainsInMethodology)}`,
              },
            ]}
          />
          {typeof es.coverageStatement === "string" ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {es.coverageStatement}
            </p>
          ) : null}
          {isObjArray(es.domainDistribution) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("es.domainCoverage")}
              </p>
              <DataTable
                rows={es.domainDistribution}
                columns={[
                  { key: "domain", label: "Domain" },
                  { key: "assessed", label: "Assessed" },
                  { key: "severityScore", label: "Severity" },
                  { key: "severityBand", label: "Band" },
                  { key: "needCount", label: "Indicators" },
                  {
                    key: "subDomainsAssessed",
                    label: "Sub-domains",
                    format: (r) =>
                      `${scalar(r.subDomainsAssessed)} / ${scalar(r.subDomainsDefined)}`,
                  },
                ]}
              />
            </div>
          ) : null}
          {isObjArray(es.topThreeCriticalNeeds) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {es.noCriticalBandReached === true
                  ? t("es.topHighest")
                  : t("es.topCritical")}
              </p>
              <DataTable rows={es.topThreeCriticalNeeds} columns={NEED_RECORD_COLUMNS} />
            </div>
          ) : null}
          {typeof es.topNeedsShortfallReason === "string" &&
          es.topNeedsShortfallReason ? (
            <p className="text-muted-foreground text-sm">{es.topNeedsShortfallReason}</p>
          ) : null}
        </div>
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

  // Evidence hero row. Headline counts belong as stat tiles, not a chart —
  // four single numbers have no shape to plot. Reads before the map so the
  // scale of the evidence base is established first.
  if (evidence) {
    const rq = isObj(c.responseQuality) ? (c.responseQuality as Dict) : {};
    const withSummary = evidenceDocs.filter((d) => isObj(d.aiSummary)).length;
    const confirmed = evidenceDocs.filter(
      (d) => scalar(d.summaryStatus) === "OFFICER_CONFIRMED",
    ).length;
    sections.push({
      title: "Evidence Base",
      node: (
        <StatTiles
          items={[
            { label: "Documents", value: evidenceDocs.length },
            { label: "With AI summary", value: withSummary },
            { label: "Officer confirmed", value: confirmed },
            {
              label: "Valid responses",
              value: scalar(rq.validResponses),
              sub: scalar(rq.overallConfidence),
            },
          ]}
        />
      ),
    });
  }

  // Evidence composition. Three different jobs, three different forms:
  // part-of-whole for summary status (a donut, few slices, sums to the whole),
  // magnitude-by-identity for document types and themes (horizontal bars —
  // the labels are long and a pie cannot be read at this cardinality), and a
  // skewed two-category split for response validity (a single bar, per
  // TwoStateBar's own note that a donut is wrong for that shape).
  if (evidence && evidenceDocs.length > 0) {
    const statusCounts = new Map<string, number>();
    for (const d of evidenceDocs) {
      const k = scalar(d.summaryStatus) || "NO_SUMMARY";
      statusCounts.set(k, (statusCounts.get(k) ?? 0) + 1);
    }
    // Reserved status colours, each carrying its own written label in the
    // donut legend — never colour alone.
    const STATUS_COLORS: Record<string, string> = {
      OFFICER_CONFIRMED: "--success",
      DRAFT: "--warning",
      SUPERSEDED: "--muted-foreground",
      NO_SUMMARY: "--destructive",
    };
    const statusSegments = [...statusCounts.entries()].map(([label, count]) => ({
      label: label.replace(/_/g, " "),
      count,
      colorVar: STATUS_COLORS[label] ?? "--chart-1",
    }));

    const tally = (pick: (d: Dict) => string) => {
      const m = new Map<string, number>();
      for (const d of evidenceDocs) {
        const k = pick(d);
        if (!k || k === "—") continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()]
        .map(([name, count]) => ({ id: name, name, count }))
        .sort((a, b) => b.count - a.count);
    };

    const byType = tally((d) => scalar(d.documentType));
    // Themes live inside each document's AI summary; counted across documents
    // so a theme raised by several documents ranks above a one-off.
    const themeCounts = new Map<string, number>();
    for (const d of evidenceDocs) {
      const ai = isObj(d.aiSummary) ? (d.aiSummary as Dict) : null;
      if (!ai || !isObjArray(ai.themes)) continue;
      for (const th of ai.themes as Dict[]) {
        const name = typeof th === "string" ? th : scalar(th.theme);
        if (!name || name === "—") continue;
        themeCounts.set(name, (themeCounts.get(name) ?? 0) + 1);
      }
    }
    const byTheme = [...themeCounts.entries()]
      .map(([name, count]) => ({ id: name, name, count }))
      .sort((a, b) => b.count - a.count);

    const rq = isObj(c.responseQuality) ? (c.responseQuality as Dict) : {};
    const submitted = num(rq.submittedResponses);
    const valid = num(rq.validResponses);

    sections.push({
      title: "Evidence Composition",
      node: (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Summary status</p>
              {/* StatusDonut renders the total itself; centerLabel is the
                  caption under it, not the number. */}
              <StatusDonut segments={statusSegments} centerLabel="Documents" />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Documents by type
              </p>
              <NamedBarList
                items={byType}
                limit={8}
                emptyText="No document types recorded."
              />
            </div>
          </div>
          {byTheme.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Themes across documents
              </p>
              <NamedBarList items={byTheme} limit={8} emptyText="No themes identified." />
            </div>
          ) : null}
          {submitted !== null && valid !== null && submitted > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Response validity
              </p>
              <TwoStateBar
                primaryLabel="Valid"
                primaryCount={valid}
                secondaryLabel="Excluded"
                secondaryCount={Math.max(0, submitted - valid)}
              />
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // Structured Geography Hierarchy
  if (isObj(c.geography)) {
    const geo = c.geography as Dict;
    // Region-level map, same component and coordinate table the NCNP report
    // uses. `regions` is region-level only (no governorate GPS data exists),
    // so the text hierarchy below carries the governorate/center detail the
    // map cannot show.
    const mapRegions = isObjArray(geo.regions)
      ? (geo.regions as unknown as NcnpNamedBreakdown[])
      : [];
    const unitLabel =
      Array.isArray(geo.mapUnitLabel) && geo.mapUnitLabel[0] === "data point"
        ? DATA_POINT_UNIT_LABEL
        : DOCUMENT_UNIT_LABEL;
    sections.push({
      title: "Geography Hierarchy",
      node: (
        // Map and text side by side, each taking half the width. The map is
        // region-level only, so the hierarchy beside it is what actually
        // carries governorate and center — they are read together, not one
        // scrolled past the other.
        <div
          className={
            mapRegions.length > 0
              ? "grid gap-4 lg:grid-cols-2 lg:items-stretch"
              : "grid gap-4"
          }
        >
          {mapRegions.length > 0 ? (
            <div className="bg-muted/20 rounded-lg border p-4">
              <p className="text-foreground mb-1 text-sm font-semibold">Kingdom Map</p>
              <p className="text-muted-foreground mb-4 text-xs">
                Markers are region-level, sized by {unitLabel[1]} in this report.
              </p>
              <RegionMap data={mapRegions} unitLabel={unitLabel} />
            </div>
          ) : null}
          <div className="bg-muted/20 flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-foreground text-sm font-semibold">Location Hierarchy</p>
            {(
              [
                ["Region", geo.region],
                ["Governorate", geo.governorate],
                ["Center", geo.center],
              ] as const
            ).map(([label, value], i) => (
              <div
                key={label}
                className={
                  i === 0
                    ? "bg-card rounded-md border p-3"
                    : "bg-card border-l-primary/40 ml-3 rounded-md border border-l-2 p-3"
                }
              >
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  {label}
                </p>
                <p className="text-foreground mt-1 text-sm font-semibold break-words">
                  {scalar(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // 2 — Response Quality (stat tiles)
  if (isObj(c.responseQuality)) {
    sections.push({
      title: t("responseQuality"),
      node: <ResponseQualityBlock rq={c.responseQuality as Dict} />,
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
        </div>
      ),
    });
  }

  // 3 — Needs by Domain → Sub-domain → Indicator. The methodology is four
  // levels deep; the report used to flatten it to one.
  if (isObjArray(c.needsByDomain)) {
    sections.push({
      title: t("needsByDomain"),
      node: (
        <div className="space-y-5">
          {c.needsByDomain.map((d, di) => (
            <div key={di} className="border-border space-y-3 border-l-2 pl-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-foreground text-sm font-semibold">
                  {scalar(d.domain)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t("hier.severity")} {scalar(d.severityScore)} · {scalar(d.confidence)}{" "}
                  · {scalar(d.kpisScored)}/{scalar(d.kpisAsked)} {t("hier.measured")}
                </span>
              </div>
              {isObjArray(d.subDomains)
                ? d.subDomains.map((s, si) => (
                    <div key={si} className="space-y-2 pl-3">
                      <p className="text-foreground text-xs font-medium">
                        {scalar(s.subDomain)} —{" "}
                        <span className="text-muted-foreground font-normal">
                          {t("hier.severity")} {scalar(s.severityScore)} ·{" "}
                          {scalar(s.confidence)}
                        </span>
                      </p>
                      {isObjArray(s.indicators) ? (
                        <DataTable
                          rows={s.indicators.flatMap((i) =>
                            isObjArray(i.needs) ? i.needs : [],
                          )}
                          columns={NEED_RECORD_COLUMNS}
                        />
                      ) : null}
                    </div>
                  ))
                : null}
            </div>
          ))}
        </div>
      ),
    });
  }

  // 4 — Pattern & Intersection Analysis. On thin data the honest version is the
  // real observations plus the sample they rest on — never an invented pattern,
  // but never an empty section either. The caveat qualifies the tables below it.
  if (isObj(c.patternAnalysis)) {
    const pa = c.patternAnalysis as Dict;
    sections.push({
      title: t("patternAnalysis"),
      node: (
        <div className="space-y-4">
          {pa.evidenceNote ? (
            <p className="text-foreground text-sm leading-relaxed">
              {scalar(pa.evidenceNote)}
            </p>
          ) : null}
          {isObjArray(pa.patterns) ? <DataTable rows={pa.patterns} /> : null}
          {isObjArray(pa.intersections) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("pa.intersections")}
              </p>
              <DataTable rows={pa.intersections} />
            </div>
          ) : null}
          {/* observedIntersections and gaps stay in the payload but are not
              rendered — matching report-doc.ts, so the PDF, the DOCX and this
              view cannot show different sections for the same report. */}
        </div>
      ),
    });
  }

  // 5 — Priority Needs. Supersedes the flat Priority block below when present,
  // so the same figure never renders twice.
  if (isObj(c.priorityNeeds)) {
    const pn = c.priorityNeeds as Dict;
    const vp = isObj(pn.villagePriority) ? (pn.villagePriority as Dict) : null;
    sections.push({
      title: t("priorityNeeds"),
      node: (
        <div className="space-y-4">
          {vp ? (
            <div className="space-y-2">
              <KeyValues
                obj={{
                  priorityScore: vp.priorityScore,
                  priorityStatus: vp.priorityStatus,
                  ...(vp.notCalculableReason
                    ? { notCalculable: vp.notCalculableReason }
                    : {}),
                  ...(vp.overrideApplied ? { override: vp.overrideReason } : {}),
                }}
              />
              {/* Severity and priority run in opposite directions on the same
                  page; saying so is cheaper than a reader inverting a finding. */}
              <p className="text-muted-foreground text-xs">
                {scalar(vp.scoreDirectionNote)}
              </p>
              <p className="text-muted-foreground text-xs">{scalar(vp.coverageBasis)}</p>
            </div>
          ) : null}
          {isObjArray(pn.needs) ? (
            <DataTable
              rows={pn.needs}
              columns={[
                { key: "rank", label: "#" },
                ...NEED_RECORD_COLUMNS,
                { key: "relevanceScore", label: "Relevance" },
              ]}
            />
          ) : null}
          {isObjArray(pn.notMeasured) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("pn.notMeasured")}
              </p>
              <DataTable rows={pn.notMeasured} columns={NEED_RECORD_COLUMNS} />
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // 4 — Priority Assessment (v1 reports only — superseded by Priority Needs).
  if (priority && !isObj(c.priorityNeeds)) {
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

  // Evidence Documents & Formatted AI Summaries (RPT15 / RPT16)
  if (isObj(c.evidenceSection) && isObjArray((c.evidenceSection as Dict).documents)) {
    const evDocs = (c.evidenceSection as Dict).documents as Dict[];
    sections.push({
      title: "Evidence Documents & AI Summaries",
      node: (
        // One accordion row per document instead of every summary expanded at
        // once: with several documents the old layout was an unreadable wall of
        // stacked blocks. The trigger carries enough to scan on (title, type,
        // status, finding count) so a reader can go straight to the one they
        // want. First row starts open so the section is never a row of closed
        // bars. Collapsing is web-only — the PDF/Excel export renders through
        // report-doc.ts and is unaffected.
        <Accordion
          type="multiple"
          defaultValue={evDocs.length > 0 ? ["ev-0"] : []}
          className="space-y-3"
        >
          {evDocs.map((doc: Dict, idx: number) => {
            const ai = doc.aiSummary as Dict | null;
            const status = scalar(doc.summaryStatus);
            const findingCount = isObjArray(ai?.keyFindings)
              ? (ai!.keyFindings as unknown[]).length
              : 0;
            return (
              <AccordionItem
                key={idx}
                value={`ev-${idx}`}
                className="bg-card rounded-lg border px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 pr-2 text-left">
                    <span className="text-muted-foreground text-[11px] font-semibold tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-foreground text-sm font-semibold">
                      {scalar(doc.title)}
                    </span>
                    <EvidenceStatusBadge status={status} />
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      {findingCount > 0
                        ? `${findingCount} finding${findingCount === 1 ? "" : "s"}`
                        : "No summary"}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4 text-xs">
                  {/* Metadata as chips rather than a run-on bullet line. */}
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["Ref", doc.sourceReferenceId],
                        ["Type", doc.documentType],
                        ["Collected", doc.collectedDate],
                      ] as const
                    ).map(([label, value]) => (
                      <span
                        key={label}
                        className="bg-muted/50 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]"
                      >
                        <span className="font-medium">{label}:</span> {scalar(value)}
                      </span>
                    ))}
                  </div>
                  {ai && (
                    <div className="space-y-3">
                      {ai.evidenceNote ? (
                        <div className="bg-info/10 border-info/30 text-foreground rounded border p-2.5 text-[10px] font-medium">
                          {String(scalar(ai.evidenceNote))}
                        </div>
                      ) : null}
                      <div>
                        <p className="text-foreground text-[11px] font-semibold">
                          Executive Qualitative Summary
                        </p>
                        <p className="text-muted-foreground mt-0.5 leading-relaxed">
                          {String(scalar(ai.summary))}
                        </p>
                      </div>
                      {isObjArray(ai.keyFindings) ? (
                        <div>
                          <p className="text-foreground mb-1 text-[11px] font-semibold">
                            Key Findings
                          </p>
                          <div className="space-y-1.5">
                            {(ai.keyFindings as Dict[]).map(
                              (kf: Dict | string, i: number) => (
                                <div key={i} className="bg-muted/20 rounded border p-2">
                                  <p className="text-foreground font-medium">
                                    {typeof kf === "string"
                                      ? kf
                                      : String(scalar(kf.finding))}
                                  </p>
                                  {typeof kf !== "string" &&
                                  (kf.sourceReferenceId || kf.pageOrSection) ? (
                                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                                      Ref: {String(scalar(kf.sourceReferenceId))} •{" "}
                                      {String(scalar(kf.pageOrSection))}
                                    </p>
                                  ) : null}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      {isObjArray(ai.themes) ? (
                        <div>
                          <p className="text-foreground mb-1 text-[11px] font-semibold">
                            Themes
                          </p>
                          <div className="space-y-1.5">
                            {(ai.themes as Dict[]).map((th: Dict | string, i: number) => (
                              <div key={i} className="bg-card rounded border p-2">
                                <p className="text-primary font-semibold">
                                  {typeof th === "string" ? th : String(scalar(th.theme))}
                                </p>
                                {typeof th !== "string" && th.description ? (
                                  <p className="text-muted-foreground mt-0.5">
                                    {String(scalar(th.description))}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {isObjArray(ai.supportingStatements) ? (
                        <div>
                          <p className="text-foreground mb-1 text-[11px] font-semibold">
                            Supporting Statements
                          </p>
                          <div className="space-y-1.5">
                            {(ai.supportingStatements as Dict[]).map(
                              (st: Dict | string, i: number) => (
                                <div
                                  key={i}
                                  className="border-primary bg-muted/10 border-l-2 py-1 pl-2.5"
                                >
                                  <p className="text-foreground font-medium">
                                    &quot;
                                    {typeof st === "string"
                                      ? st
                                      : String(scalar(st.statement))}
                                    &quot;
                                  </p>
                                  {typeof st !== "string" &&
                                  (st.sourceReferenceId ||
                                    st.pageOrSection ||
                                    st.sectionOrPageRef) ? (
                                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                                      Ref: {String(scalar(st.sourceReferenceId))} •{" "}
                                      {String(
                                        scalar(st.pageOrSection || st.sectionOrPageRef),
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                      {isObjArray(ai.risksOrConcerns) ? (
                        <div>
                          <p className="text-foreground mb-1 text-[11px] font-semibold">
                            Risks / Concerns
                          </p>
                          <div className="space-y-1">
                            {(ai.risksOrConcerns as Dict[]).map(
                              (r: Dict | string, i: number) => (
                                <div
                                  key={i}
                                  className="border-warning/30 bg-warning/10 text-foreground rounded border p-2"
                                >
                                  <p className="font-medium">
                                    {typeof r === "string"
                                      ? r
                                      : String(scalar(r.concern))}
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ),
    });
  }

  // Combined AI summary (RPT16). Previously stored but rendered nowhere — the
  // whole combined narrative was invisible in both the web view and the exports.
  // Quantitative and qualitative halves stay in separate blocks, matching the
  // separation the generating prompt enforces.
  if (isObj(c.combinedSummarySection)) {
    const cs = c.combinedSummarySection as Dict;
    const score = isObj(cs.scoreBasedFindings) ? (cs.scoreBasedFindings as Dict) : null;
    sections.push({
      title: "Combined Summary",
      node: (
        <div className="space-y-4 text-xs">
          {typeof cs.executiveSummary === "string" && cs.executiveSummary ? (
            <p className="text-muted-foreground leading-relaxed">{cs.executiveSummary}</p>
          ) : null}

          {score
            ? // Was three bare numbers on one sparse row, with `topDomainsOrKpis`
              // — the only part of this block with any shape to it — dropped
              // entirely. Now: the two scores as gauges (a 0–100 score against a
              // fixed scale is exactly what a gauge is for), the ranked
              // domains/KPIs as bars beside them, and the confidence note as a
              // footnote rather than a floating sentence.
              (() => {
                const sev = num(score.overallSeverityScore);
                const pri = num(score.priorityScore);
                const tops = isObjArray(score.topDomainsOrKpis)
                  ? (score.topDomainsOrKpis as Dict[])
                  : [];
                const topBars = tops
                  .map((d) => ({ label: scalar(d.name), value: num(d.score) ?? 0 }))
                  .sort((a, b) => b.value - a.value);
                return (
                  <div className="bg-muted/20 space-y-4 rounded-lg border p-4">
                    <p className="text-foreground text-[11px] font-semibold uppercase">
                      Score-Based Findings
                    </p>
                    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                      <div className="flex flex-wrap items-center gap-5">
                        {sev !== null ? (
                          <Gauge value={sev} max={100} label="Overall Severity" />
                        ) : null}
                        {pri !== null ? (
                          <Gauge
                            value={pri}
                            max={100}
                            label="Priority Score"
                            sub={scalar(score.priorityStatus)}
                          />
                        ) : null}
                      </div>
                      {topBars.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs font-medium">
                            Top domains / KPIs by severity
                          </p>
                          <BarChart bars={topBars} max={100} />
                        </div>
                      ) : null}
                    </div>
                    {score.confidenceDataQualityNote ? (
                      <p className="text-muted-foreground border-t pt-3 text-[11px] leading-relaxed">
                        {scalar(score.confidenceDataQualityNote)}
                      </p>
                    ) : null}
                  </div>
                );
              })()
            : null}

          {isObjArray(cs.documentBasedEvidence) ? (
            <div>
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                Document-Based Evidence
              </p>
              <div className="space-y-1.5">
                {(cs.documentBasedEvidence as Dict[]).map((e, i) => (
                  <div key={i} className="bg-card rounded border p-2">
                    <p className="text-foreground font-medium">
                      {scalar(e.documentTitle)}
                    </p>
                    <p className="text-muted-foreground">
                      {scalar(e.keyEvidenceFinding)}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Ref: {scalar(e.sourceReferenceId)} • {scalar(e.linkedNeedOrDomain)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // Score-based AI narrative (RPT16). The combined report is the union of the
  // score report and the evidence report, so it carries this in full alongside
  // the combined narrative. `recommendations` is deliberately absent here — the
  // backend hoists both summaries' lists into one de-duplicated top-level list.
  if (isObj(c.scoreSummarySection)) {
    const ss = c.scoreSummarySection as Dict;
    sections.push({
      title: "Score-Based Summary",
      node: (
        <div className="space-y-4 text-xs">
          {typeof ss.executiveSummary === "string" && ss.executiveSummary ? (
            <p className="text-muted-foreground leading-relaxed">{ss.executiveSummary}</p>
          ) : null}

          {typeof ss.priorityExplanation === "string" && ss.priorityExplanation ? (
            <div className="bg-muted/20 rounded-lg border p-3">
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                Priority Explanation
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {ss.priorityExplanation}
              </p>
            </div>
          ) : null}

          {isObjArray(ss.keyFindings) ? (
            <div>
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                Key Findings
              </p>
              <div className="space-y-1.5">
                {(ss.keyFindings as Dict[]).map((f, i) => (
                  <div key={i} className="bg-card rounded border p-2">
                    <p className="text-foreground font-medium">{scalar(f.title)}</p>
                    <p className="text-muted-foreground">{scalar(f.summary)}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {scalar(f.domain)} • {scalar(f.kpi)} • Confidence:{" "}
                      {scalar(f.confidence)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isObjArray(ss.domainInsights) ? (
            <div>
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                Domain Insights
              </p>
              <DataTable rows={ss.domainInsights as Dict[]} />
            </div>
          ) : null}

          {ss.criticalOverrideNote ? (
            <p className="border-warning/30 bg-warning/10 text-foreground rounded border p-2">
              {scalar(ss.criticalOverrideNote)}
            </p>
          ) : null}

          {ss.dataQualityNote ? (
            <p className="text-muted-foreground">{scalar(ss.dataQualityNote)}</p>
          ) : null}
        </div>
      ),
    });
  }

  // Top-level recommendations (RPT15 / RPT16). The block further down handles
  // `aiSummary.recommendations`, which is a different field.
  if (Array.isArray(c.recommendations) && c.recommendations.length > 0) {
    sections.push({
      title: t("recommendations"),
      node: (
        <ul className="space-y-1.5">
          {(c.recommendations as unknown[]).map((r, i) => (
            <li
              key={i}
              className="bg-muted/20 flex items-start gap-2 rounded border p-2 text-xs"
            >
              <ArrowRight className="text-primary mt-0.5 size-3.5 shrink-0 rtl:rotate-180" />
              <span className="text-foreground">
                {isObj(r) ? scalar((r as Dict).intervention) : String(r)}
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

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
                <p className="text-foreground text-sm leading-relaxed">
                  {localizeReportText(scalar(ai[k]), locale)}
                </p>
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

  // 6 — Data Quality Notes. MANDATORY: rendered whenever the block exists, even
  // when every sub-field is empty.
  if (isObj(c.dataQualityNotes)) {
    const dq = c.dataQualityNotes as Dict;
    const rq = isObj(dq.responseQuality) ? (dq.responseQuality as Dict) : {};
    const conf = isObj(dq.confidence) ? (dq.confidence as Dict) : {};
    sections.push({
      title: t("dataQualityNotes"),
      node: (
        <div className="space-y-4">
          <StatTiles
            items={[
              { label: t("dq.submitted"), value: scalar(rq.submitted) },
              {
                label: t("dq.valid"),
                value: scalar(rq.valid),
                sub: `${scalar(rq.validResponseRatePct)}% ${t("cov.ofSubmitted")}`,
              },
              { label: t("dq.excluded"), value: scalar(rq.excluded) },
              {
                label: t("dq.dontKnow"),
                value: `${scalar(rq.dontKnowRatePct)}%`,
                sub: scalar(rq.dontKnowBand),
              },
              {
                label: t("dq.confidence"),
                value: scalar(conf.flag),
                sub: `${t("dq.sample")} ${scalar(conf.sampleSize)} / ${scalar(conf.sampleThreshold)}`,
              },
              { label: t("dq.notMeasured"), value: scalar(dq.notMeasuredCount) },
            ]}
          />
          {typeof dq.narrative === "string" ? (
            <p className="text-foreground text-sm leading-relaxed">{dq.narrative}</p>
          ) : null}
          {/* Survey-level cycle-over-cycle note. KEEP IN SYNC with
              dataQualitySections in the backend's report-doc.ts. */}
          {typeof dq.trendNote === "string" && dq.trendNote ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">{t("dq.trend")}</p>
              <p className="text-foreground text-sm leading-relaxed">
                {localizeReportText(dq.trendNote, locale)}
              </p>
            </div>
          ) : null}
          {isObjArray(dq.exclusionBreakdown) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("dq.answerStatus")}
              </p>
              <DataTable rows={dq.exclusionBreakdown} />
            </div>
          ) : null}
          {isObjArray(dq.notMeasured) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("dq.notMeasuredList")}
              </p>
              <DataTable rows={dq.notMeasured} />
            </div>
          ) : null}
          {Array.isArray(dq.domainsNotAssessed) && dq.domainsNotAssessed.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium">
                {t("dq.domainsNotAssessed")}
              </p>
              <p className="text-foreground text-sm">
                {dq.domainsNotAssessed.map(String).join(", ")}
              </p>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // Every need record, flat — the payload the Merged and NCNP reports consume,
  // shown so the on-screen view and the export carry the same rows.
  if (isObjArray(c.needRecords)) {
    sections.push({
      title: t("needRecords"),
      node: <DataTable rows={c.needRecords} columns={NEED_RECORD_COLUMNS} />,
    });
  }

  // First-class Data Quality and Trend notes (promoted out of the AI Summary —
  // currently the region report) rendered as their own distinct sections.
  // Suppressed when the structured Section 6 above is present, so the same note
  // never appears twice.
  if (
    !isObj(c.dataQualityNotes) &&
    typeof c.dataQualityNote === "string" &&
    c.dataQualityNote
  ) {
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
        <p className="text-foreground text-sm leading-relaxed">
          {localizeReportText(scalar(c.trendNote), locale)}
        </p>
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
