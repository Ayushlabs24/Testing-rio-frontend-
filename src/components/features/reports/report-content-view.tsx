"use client";

import { ArrowRight, FileText, Sparkles, Table2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import { localizeReportText } from "@/lib/report-narrative-i18n";
import { formatDate, formatNumber } from "@/lib/format-date";
import { AutoTranslate } from "@/components/common/auto-translate";
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
// NOTE: "Yes"/"No" below are a deliberate, known exception — `scalar` is a
// plain function (not a component) called from ~46 places across this file,
// several outside any component scope, so it has no access to a translator.
// Localizing these two words correctly would mean threading a `yesNo` tuple
// through every one of those call sites; left as a follow-up rather than
// risking a rushed, wide-blast-radius refactor of this file's core formatter.
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

// These used to be module-level literal constants for referential stability
// (RegionMap rebuilds every marker when its `unitLabel` prop is a fresh
// array each render) — now built once per render via `useMemo` inside
// `ReportContentView` instead, since the labels need a translator. See
// `documentUnitLabel`/`dataPointUnitLabel` there.

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
// `ColSpec.label` needs a translator, and this array is read at module-load
// time — before any component (and its `t`) exists — so it's built by a
// factory called once inside `ReportContentView`, instead of being a plain
// module-level constant.
function domainColumns(t: (key: string) => string): ColSpec[] {
  return [
    { key: "name", label: t("col.domain") },
    { key: "domainCode", label: t("col.code") },
    // Severity is ALWAYS shown. Null renders "—", never 0.
    // This is the AVERAGE; the two that follow are the methodology's no-masking
    // rule (a domain can average Low while hiding a Critical KPI). KEEP IN SYNC
    // with DOMAIN_TABLE_COLS in report-doc.ts — the export and the screen must
    // show the same columns or a masking domain is visible in only one of them.
    { key: "severityScore", label: t("col.avgSeverity") },
    { key: "maxKpiSeverity", label: t("col.maxKpiSeverity") },
    // The worst KPI's NAME is not a column here either — it is in the Domain
    // Masking Alert, where it is actionable. See DOMAIN_TABLE_COLS in report-doc.ts.
    { key: "performanceScore", label: t("col.performance") },
    { key: "weight", label: t("col.weight") },
    { key: "kpiCount", label: t("col.kpisDefined") },
    { key: "confidence", label: t("col.confidence") },
    { key: "validResponseRatePct", label: t("col.validPct") },
    { key: "isCriticalDomain", label: t("col.critical") },
    { key: "masksCriticalFinding", label: t("col.masking") },
  ];
}

// One row per Unified Need Record — the client's domain / sub-domain /
// indicator classification, with severity always visible.
function needRecordColumns(
  t: (key: string, values?: Record<string, string>) => string,
): ColSpec[] {
  return [
    { key: "domain", label: t("col.domain") },
    { key: "subDomain", label: t("col.subDomain") },
    { key: "indicatorName", label: t("col.indicator") },
    { key: "severityScore", label: t("col.severity") },
    { key: "severityBand", label: t("col.band") },
    { key: "confidence", label: t("col.confidence") },
    { key: "equityFlag", label: t("col.equity") },
    { key: "validResponseCount", label: t("col.responses") },
    // Why this row carries no severity, or why its equity check could not run —
    // a blank Equity "No" would otherwise read as "checked, no inequity found".
    { key: "notMeasuredReason", label: t("col.notes"), format: makeNeedNotes(t) },
  ];
}

// Where a need sits, compact enough for a table cell. The full scope sentence
// (`unitGeo.scopeLabel`) belongs in the Geographic Scope block, not in a column
// with eleven neighbours — so take the most specific single place name.
function compactGeoLabel(r: Dict): string {
  const g = r.unitGeo;
  if (!isObj(g)) return "—";
  const villages = Array.isArray(g.villages)
    ? g.villages.filter((v): v is string => typeof v === "string")
    : [];
  const govs = Array.isArray(g.governorateNames)
    ? g.governorateNames.filter((v): v is string => typeof v === "string")
    : [];
  if (villages.length === 1) return villages[0];
  if (govs.length === 1) return govs[0];
  if (govs.length > 1) return `${govs[0]} +${govs.length - 1}`;
  if (typeof g.regionName === "string" && g.regionName) return g.regionName;
  return "—";
}

// The client's Top-Priority specification as columns: "domain, sub-domain,
// location, priority score, severity, affected population, and ranking".
//
// MIRRORS report-doc.ts's PRIORITY_NEED_COLS exactly — the on-screen report and
// the exported PDF/Excel are the same report, and a column that exists in one
// and not the other is the export-parity failure AC 2 is about.
//
// `relevanceScore` is headed "Priority Score" because that is the client's word
// for the priority-scoring mechanism's per-need output. It read "Relevance",
// while the only thing on the page labelled "Priority Score" was a different,
// village-level figure.
function priorityNeedColumns(t: (key: string) => string, locale: AppLocale): ColSpec[] {
  return [
    { key: "rank", label: t("col.rank") },
    { key: "domain", label: t("col.domain") },
    { key: "subDomain", label: t("col.subDomain") },
    { key: "indicatorName", label: t("col.indicator") },
    { key: "unitGeo", label: t("col.location"), format: compactGeoLabel },
    {
      key: "relevanceScore",
      label: t("priorityScore"),
      format: (r) =>
        typeof r.relevanceScore === "number" ? r.relevanceScore.toFixed(2) : "—",
    },
    { key: "severityScore", label: t("col.severity") },
    { key: "severityBand", label: t("col.band") },
    // The source Need's own recorded estimate (the need-entry question). A dash
    // when it was never answered, with the reason stated beneath the table —
    // never the study-area figure. Mirrors report-doc.ts.
    {
      key: "affectedPopulation",
      label: t("col.affectedPop"),
      format: (r) =>
        // Was hardcoded to the "en-GB" locale regardless of UI language — the
        // exact class of bug fixed elsewhere in this pass (formatNumber()).
        typeof r.affectedPopulation === "number"
          ? formatNumber(r.affectedPopulation, locale)
          : "—",
    },
    { key: "confidence", label: t("col.confidence") },
    { key: "equityFlag", label: t("col.equity") },
    { key: "validResponseCount", label: t("col.responses") },
  ];
}

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

// The methodology's no-masking rule, made explicit for the reader who reads the
// average column and stops there. Mirrors the "Domain Masking Alert" note the
// PDF/Excel export emits (report-doc.ts) — a masking domain must be equally
// visible on screen and in the exported file.
function DomainMaskingAlert({ domains }: { domains: Dict[] }) {
  const t = useTranslations("app.reports.content");
  const masked = domains.filter((d) => d.masksCriticalFinding === true);
  if (masked.length === 0) return null;
  const details = masked
    .map((d) =>
      t("dma.domainDetail", {
        name: scalar(d.name),
        kpi: scalar(d.maxKpiName),
        severity: scalar(d.maxKpiSeverity),
      }),
    )
    .join("; ");
  return (
    <div className="border-warning/40 bg-warning/10 text-foreground rounded-md border p-3 text-sm">
      <p className="font-semibold">{t("dma.title")}</p>
      <p className="mt-1 leading-relaxed">
        {t("dma.body", { count: String(masked.length), details })}
      </p>
    </div>
  );
}

// Response Quality, in reading order with explicit labels. The confidence BAND,
// the REASON for it and the valid-response RATE are three distinct facts; the
// auto-derived labels turned `dontKnowBand` into "Dont Know Band" and printed
// the rate without a unit.
function ResponseQualityBlock({ rq }: { rq: Dict }) {
  const t = useTranslations("app.reports.content");
  const pct = (v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}%` : scalar(v));
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [
    { label: t("rq2.overallConfidence"), value: scalar(rq.overallConfidence) },
    { label: t("cov.submitted"), value: scalar(rq.submittedResponses) },
    { label: t("cov.valid"), value: scalar(rq.validResponses) },
    { label: t("rq2.validResponseRate"), value: `${scalar(rq.validResponseRatePct)}%` },
    { label: t("dq.dontKnow"), value: pct(rq.dontKnowRate) },
    { label: t("rq2.dontKnowBand"), value: scalar(rq.dontKnowBand) },
  ];
  // RIO-FR-024: the study's own signed-off sample-size target — absent
  // entirely (not just null) for studies created before this field existed,
  // so these three rows only appear when the backend actually sent them.
  if (
    rq.population != null ||
    rq.requiredSampleSize != null ||
    rq.minimumDetectableEffect != null
  ) {
    rows.push(
      { label: t("rq2.populationArea"), value: scalar(rq.population) },
      { label: t("rq2.requiredSampleSize"), value: scalar(rq.requiredSampleSize) },
      {
        label: t("rq2.minDetectableEffect"),
        value:
          typeof rq.minimumDetectableEffect === "number"
            ? t("rq2.minDetectableEffectValue", {
                value: rq.minimumDetectableEffect.toFixed(1),
              })
            : scalar(rq.minimumDetectableEffect),
      },
    );
  }
  return (
    <div className="space-y-3">
      <StatTiles items={rows} />
      {typeof rq.confidenceReason === "string" && rq.confidenceReason ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {t("rq2.whyThisBand")}
          </p>
          <p className="text-foreground text-sm leading-relaxed">
            <AutoTranslate text={rq.confidenceReason} />
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Factory, not a plain function: the "Equity not evaluable:" prefix is a
// static label needing translation, but `needNotes` itself is called from a
// `ColSpec.format` (a plain string-returning function, not a component), so
// it has no translator of its own — the caller resolves `t` once and passes
// the bound formatter down.
function makeNeedNotes(t: (key: string, values?: Record<string, string>) => string) {
  return function needNotes(r: Dict): string {
    if (typeof r.notMeasuredReason === "string" && r.notMeasuredReason)
      return r.notMeasuredReason;
    const eq = r.equityDetail;
    if (isObj(eq) && eq.evaluable === false && typeof eq.reason === "string") {
      return t("equityNotEvaluable", { reason: eq.reason });
    }
    return "";
  };
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
  // Built once per render, now that `t`/`locale` exist — see each factory's
  // own comment for why these can't be plain module-level constants.
  const domainCols = domainColumns(t);
  const needRecordCols = needRecordColumns(t);
  const priorityNeedCols = priorityNeedColumns(t, locale);
  // Referentially stable across renders (see the removed module-level
  // constants' old comment) — RegionMap/LeafletMapContainer rebuild every
  // marker when this array's identity changes.
  const documentUnitLabel = useMemo(
    () => [t("unitDocumentSingular"), t("unitDocumentPlural")] as const,
    [t],
  );
  const dataPointUnitLabel = useMemo(
    () => [t("unitDataPointSingular"), t("unitDataPointPlural")] as const,
    [t],
  );
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
      // RPT03/RPT09 Top-Priority and RPT10 Data-Quality. KEEP IN SYNC with the
      // identical predicate in report-doc.ts — when the two disagree, a report
      // renders as a structured document in one place and as a flat key-value
      // dump in the other.
      isObjArray(c.tierSummary) ||
      isObjArray(c.completeness) ||
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

  // What a study-scoped report actually read (RPT04). Study-scoped reports are
  // built from ONE resolved survey; when the study has more, saying so up front
  // changes how every figure below should be read.
  if (isObj(c.scopeBasis)) {
    const sb = c.scopeBasis as Dict;
    sections.push({
      title: t("title.scopeBasis"),
      node: (
        <div className="space-y-3">
          <KeyValues
            obj={{
              survey: sb.surveyTitle,
              surveysInStudy: sb.studySurveyCount,
              selectedBy:
                sb.resolution === "EXPLICIT_FILTER"
                  ? t("scopeBasisValue.explicitFilter")
                  : t("scopeBasisValue.latestPublished"),
            }}
          />
          {typeof sb.partialScopeNote === "string" && sb.partialScopeNote ? (
            <div className="border-warning/40 bg-warning/10 text-foreground rounded-md border p-3 text-sm">
              <p className="font-semibold">{t("partialScope")}</p>
              <p className="mt-1 leading-relaxed">
                <AutoTranslate text={sb.partialScopeNote} />
              </p>
            </div>
          ) : null}
        </div>
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
              <AutoTranslate text={es.coverageStatement} />
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
                  { key: "domain", label: t("col.domain") },
                  { key: "assessed", label: t("col.assessed") },
                  { key: "severityScore", label: t("col.severity") },
                  { key: "severityBand", label: t("col.band") },
                  { key: "needCount", label: t("col.indicators") },
                  {
                    key: "subDomainsAssessed",
                    label: t("col.subDomains"),
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
              <DataTable rows={es.topThreeCriticalNeeds} columns={needRecordCols} />
            </div>
          ) : null}
          {typeof es.topNeedsShortfallReason === "string" &&
          es.topNeedsShortfallReason ? (
            <p className="text-muted-foreground text-sm">
              <AutoTranslate text={es.topNeedsShortfallReason} />
            </p>
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
      title: t("title.evidenceBase"),
      node: (
        <StatTiles
          items={[
            { label: t("col.documents"), value: evidenceDocs.length },
            { label: t("col.withAiSummary"), value: withSummary },
            { label: t("col.officerConfirmed"), value: confirmed },
            {
              label: t("cov.valid"),
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
      title: t("title.evidenceComposition"),
      node: (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("col.summaryStatus")}
              </p>
              {/* StatusDonut renders the total itself; centerLabel is the
                  caption under it, not the number. */}
              <StatusDonut
                segments={statusSegments}
                centerLabel={t("col.documents")}
                locale={locale}
              />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("col.documentsByType")}
              </p>
              <NamedBarList
                locale={locale}
                items={byType}
                limit={8}
                emptyText={t("noDocumentTypesRecorded")}
              />
            </div>
          </div>
          {byTheme.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("col.themesAcrossDocuments")}
              </p>
              <NamedBarList
                items={byTheme}
                limit={8}
                emptyText={t("noThemesIdentified")}
                locale={locale}
              />
            </div>
          ) : null}
          {submitted !== null && valid !== null && submitted > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("col.responseValidity")}
              </p>
              <TwoStateBar
                locale={locale}
                primaryLabel={t("col.validShort")}
                primaryCount={valid}
                secondaryLabel={t("col.excludedShort")}
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
        ? dataPointUnitLabel
        : documentUnitLabel;
    sections.push({
      title: t("title.geographyHierarchy"),
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
              <p className="text-foreground mb-1 text-sm font-semibold">
                {t("kingdomMap")}
              </p>
              <p className="text-muted-foreground mb-4 text-xs">
                {t("markersRegionLevel", { unit: unitLabel[1] })}
              </p>
              <RegionMap data={mapRegions} unitLabel={unitLabel} />
            </div>
          ) : null}
          <div className="bg-muted/20 flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-foreground text-sm font-semibold">
              {t("locationHierarchy")}
            </p>
            {(
              [
                [t("col.region"), geo.region],
                [t("col.governorate"), geo.governorate],
                [t("col.center"), geo.center],
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
          <DataTable rows={domains} columns={domainCols} />
          <DomainMaskingAlert domains={domains} />
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
                          columns={needRecordCols}
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

  // RPT03/RPT09 Top-Priority — tier distribution, then the domain rollup with
  // the methodology's no-masking columns. Both sit above Priority Needs so the
  // shape of the findings is read before the findings themselves.
  if (isObjArray(c.tierSummary)) {
    sections.push({
      title: t("tierSummary"),
      node: (
        <DataTable
          rows={c.tierSummary}
          columns={[
            { key: "tier", label: t("col.priorityTier") },
            { key: "count", label: t("port.needs") },
            { key: "sharePct", label: t("col.sharePct") },
            { key: "equityFlagged", label: t("col.equityFlagged") },
          ]}
        />
      ),
    });
  }

  if (isObjArray(c.domainRollup)) {
    const masking = c.domainRollup.filter((r) => r.masksCriticalFinding === true);
    sections.push({
      title: t("domainRollup"),
      node: (
        <div className="space-y-3">
          <DataTable
            rows={c.domainRollup}
            columns={[
              { key: "domain", label: t("col.domain") },
              { key: "averageSeverity", label: t("col.avgSeverity") },
              // The no-masking column. A domain can average LOW while hiding a
              // CRITICAL KPI, so the max is shown beside the average, never
              // instead of it.
              { key: "maxKpiSeverity", label: t("col.maxKpiSeverity") },
              { key: "criticalKpiCount", label: t("col.criticalKpis") },
              { key: "kpiCount", label: t("col.kpisDefined") },
            ]}
          />
          {masking.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              {t("noMaskingAlert")}: {masking.map((r) => scalar(r.domain)).join(", ")}
            </p>
          ) : null}
        </div>
      ),
    });
  }

  // RPT10 Data-Quality — completeness tiles, per-domain confidence, then the
  // flagged records themselves.
  if (isObjArray(c.completeness)) {
    sections.push({
      title: t("completeness"),
      node: (
        <DataTable
          rows={c.completeness}
          columns={[
            { key: "label", label: t("col.measure") },
            { key: "value", label: t("col.value") },
          ]}
        />
      ),
    });
  }

  // Data-collection completeness — client Q14 answer (a), settled 24 Aug:
  // unanswered required questions and the survey abandonment rate, with
  // abandoned sittings counted INTO the invalid-response figure rather than
  // reported as their own category. Mirrors report-doc.ts section for section;
  // a block present in the export and absent here is the export-parity failure
  // AC 2 exists to prevent.
  if (isObj(c.dataCollection)) {
    const dc = c.dataCollection as Dict;
    const scope = isObj(dc.scope) ? (dc.scope as Dict) : null;
    const ab = isObj(dc.abandonment) ? (dc.abandonment as Dict) : null;
    const un = isObj(dc.unansweredRequired) ? (dc.unansweredRequired as Dict) : null;
    const inv = isObj(dc.invalidResponses) ? (dc.invalidResponses as Dict) : null;

    if (scope) {
      sections.push({
        title: t("dataCollectionScope"),
        node: (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">{scalar(scope.note)}</p>
            {isObjArray(scope.coveredSurveys) ? (
              <DataTable
                rows={scope.coveredSurveys}
                columns={[
                  { key: "title", label: t("survey") },
                  { key: "version", label: t("col.version") },
                  { key: "status", label: t("col.status") },
                  { key: "responses", label: t("submittedResponses") },
                ]}
              />
            ) : null}
            {isObjArray(scope.excludedSurveys) ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {t("surveysNotCovered")}
                </p>
                <DataTable
                  rows={scope.excludedSurveys}
                  columns={[
                    { key: "title", label: t("survey") },
                    { key: "version", label: t("col.version") },
                    { key: "status", label: t("col.status") },
                    { key: "responses", label: t("submittedResponses") },
                  ]}
                />
              </div>
            ) : null}
          </div>
        ),
      });
    }

    if (ab) {
      sections.push({
        title: t("abandonment"),
        node: (
          <div className="space-y-3">
            <DataTable
              rows={[
                { measure: t("sessionsStarted"), value: scalar(ab.sessionsStarted) },
                { measure: t("sessionsSubmitted"), value: scalar(ab.submitted) },
                { measure: t("sessionsAbandoned"), value: scalar(ab.abandoned) },
                { measure: t("sessionsInFlight"), value: scalar(ab.inFlight) },
                {
                  measure: t("abandonmentRate"),
                  // The threshold travels with the rate — a percentage whose
                  // definition is a config value must never be shown bare.
                  value: `${scalar(ab.abandonmentRatePct)}% (${scalar(ab.resolvedSessions)} resolved, >${scalar(ab.idleThresholdMinutes)}m idle)`,
                },
                {
                  measure: t("meanProgressWhenAbandoned"),
                  value:
                    ab.meanProgressPct === null ? "—" : `${scalar(ab.meanProgressPct)}%`,
                },
                { measure: t("remindersSent"), value: scalar(ab.remindersSent) },
                {
                  measure: t("responsesWithoutSession"),
                  value: scalar(ab.responsesWithoutSession),
                },
              ]}
              columns={[
                { key: "measure", label: t("col.measure") },
                { key: "value", label: t("col.value") },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              <AutoTranslate text={scalar(ab.note)} />
            </p>
            {isObjArray(ab.byStage) ? (
              <DataTable
                rows={ab.byStage}
                columns={[
                  { key: "stageLabel", label: t("col.stoppedAt") },
                  { key: "count", label: t("col.sessions") },
                  {
                    key: "sharePct",
                    label: t("col.share"),
                    format: (r) => `${scalar(r.sharePct)}%`,
                  },
                ]}
              />
            ) : null}
          </div>
        ),
      });
    }

    if (inv) {
      sections.push({
        title: t("invalidResponses"),
        node: (
          <div className="space-y-3">
            <DataTable
              rows={[
                { measure: t("excludedSubmitted"), value: scalar(inv.excludedSubmitted) },
                { measure: t("abandonedSessions"), value: scalar(inv.abandonedSessions) },
                { measure: t("invalidTotal"), value: scalar(inv.total) },
              ]}
              columns={[
                { key: "measure", label: t("col.measure") },
                { key: "value", label: t("col.value") },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              <AutoTranslate text={scalar(inv.basis)} />
            </p>
          </div>
        ),
      });
    }

    if (un) {
      sections.push({
        title: t("unansweredRequired"),
        node: (
          <div className="space-y-3">
            <DataTable
              rows={[
                {
                  measure: t("requiredQuestions"),
                  value: scalar(un.requiredQuestionCount),
                },
                {
                  measure: t("submittedResponses"),
                  value: scalar(un.submittedResponses),
                },
                {
                  measure: t("requiredAnswerSlots"),
                  value: scalar(un.requiredAnswerSlots),
                },
                {
                  measure: t("leftBlank"),
                  value: `${scalar(un.unansweredCount)} (${scalar(un.unansweredRatePct)}%)`,
                },
              ]}
              columns={[
                { key: "measure", label: t("col.measure") },
                { key: "value", label: t("col.value") },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              <AutoTranslate text={scalar(un.note)} />
            </p>
            {isObjArray(un.byQuestion) ? (
              <DataTable
                rows={un.byQuestion}
                columns={[
                  { key: "questionText", label: t("col.requiredQuestion") },
                  { key: "domain", label: t("col.domain") },
                  { key: "surveyTitle", label: t("survey") },
                  { key: "unanswered", label: t("leftBlank") },
                  { key: "ofResponses", label: t("col.ofResponses") },
                  {
                    key: "unansweredPct",
                    label: t("col.rate"),
                    format: (r) => `${scalar(r.unansweredPct)}%`,
                  },
                ]}
              />
            ) : null}
          </div>
        ),
      });
    }
  }

  if (isObjArray(c.domainConfidence)) {
    sections.push({
      title: t("domainConfidence"),
      node: (
        <DataTable
          rows={c.domainConfidence}
          columns={[
            { key: "domain", label: t("col.domain") },
            { key: "confidence", label: t("col.confidence") },
            { key: "validResponseRatePct", label: t("col.validResponsePct") },
            { key: "dontKnowRatePct", label: t("col.dontKnowPct") },
            { key: "kpiCount", label: t("col.kpis") },
            { key: "reason", label: t("rq2.whyThisBand") },
          ]}
        />
      ),
    });
  }

  // Array.isArray, NOT isObjArray — an EMPTY list must still render its
  // section. A missing section reads as "quality was not checked" rather than
  // "nothing was flagged", and under AC 6 those are opposite claims.
  if (Array.isArray(c.flaggedRecords)) {
    const flagged = c.flaggedRecords as Dict[];
    sections.push({
      title: t("flaggedRecords"),
      node: (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            {flagged.length === 0 ? t("flaggedRecordsNone") : t("flaggedRecordsNote")}
          </p>
          {flagged.length > 0 ? (
            <DataTable
              rows={flagged}
              columns={[
                { key: "flag", label: t("col.flag") },
                { key: "domain", label: t("col.domain") },
                { key: "indicatorName", label: t("col.indicator") },
                { key: "reason", label: t("col.reason") },
              ]}
            />
          ) : null}
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
                  // "Village Priority Score", not "Priority Score": this is the
                  // VILLAGE-level performance figure (lower = more urgent),
                  // while the Priority Needs table's Priority Score column is
                  // the per-need ranking figure (higher = more urgent). Two
                  // numbers running in opposite directions must not share a name
                  // on one page. Mirrors report-doc.ts.
                  villagePriorityScore:
                    typeof vp.priorityScore === "number"
                      ? vp.priorityScore.toFixed(2)
                      : vp.priorityScore,
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
                <AutoTranslate text={scalar(vp.scoreDirectionNote)} />
              </p>
              <p className="text-muted-foreground text-xs">
                <AutoTranslate text={scalar(vp.coverageBasis)} />
              </p>
            </div>
          ) : null}
          {isObjArray(pn.needs) ? (
            <div className="space-y-2">
              <DataTable rows={pn.needs} columns={priorityNeedCols} />
              {/* How the order was arrived at, beneath the order itself. The
                  methodology asks that a reader be able to RECOMPUTE the
                  ranking, which a formula left in the payload does not allow. */}
              {typeof pn.rankingBasis === "string" && pn.rankingBasis ? (
                <p className="text-muted-foreground text-xs">
                  {t("pn.rankingBasis", { basis: pn.rankingBasis })}
                </p>
              ) : null}
              {/* Both granularity limits, stated on the table so neither column
                  can be read as claiming more than it does. */}
              {new Set((pn.needs as Dict[]).map(compactGeoLabel)).size === 1 ? (
                <p className="text-muted-foreground text-xs">
                  {t("pn.locationScope", {
                    location: compactGeoLabel((pn.needs as Dict[])[0]!),
                  })}
                </p>
              ) : null}
              {/* Two different things to say about the same column, depending
                  on whether an estimate was actually given — the export says
                  the same two, chosen the same way. */}
              <p className="text-muted-foreground text-xs">
                {(pn.needs as Dict[]).every(
                  (n) => typeof n.affectedPopulation !== "number",
                )
                  ? t("pn.affectedPopulationMissing")
                  : t("pn.affectedPopulationScope")}
              </p>
            </div>
          ) : null}
          {isObjArray(pn.notMeasured) ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                {t("pn.notMeasured")}
              </p>
              <DataTable rows={pn.notMeasured} columns={needRecordCols} />
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
              <p className="text-foreground">
                <AutoTranslate text={scalar(priority.overrideReason)} />
              </p>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  // The arithmetic behind the headline figures, with this report's own numbers.
  //
  // The block has always been built and was rendered NOWHERE — neither here nor
  // in the PDF. The methodology's explainability requirement ("the components of
  // every score are displayed") is about the report a person reads, not the
  // payload behind it. Mirrors calculationBasisSections() in report-doc.ts.
  if (isObj(c.calculationBasis)) {
    const cb = c.calculationBasis as Dict;
    const working = (key: string) =>
      Array.isArray(cb[key]) ? (cb[key] as unknown[]).map(String) : [];
    const needsIndex = working("needsIndexWorking");
    const priorityScore = working("priorityScoreWorking");
    sections.push({
      title: t("calculationBasis"),
      node: (
        <div className="space-y-4">
          <KeyValues
            obj={{
              needsIndexFormula: cb.needsIndexFormula,
              priorityScoreFormula: cb.priorityScoreFormula,
              severityBandingRule: cb.severityBandingRule,
              confidenceRule: cb.confidenceRule,
              equityRule: cb.equityRule,
              gapTypeRule: cb.gapTypeRule,
            }}
          />
          {[
            { label: t("cb.needsIndexWorking"), items: needsIndex },
            { label: t("cb.priorityScoreWorking"), items: priorityScore },
          ]
            .filter((b) => b.items.length > 0)
            .map((b) => (
              <div key={b.label} className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">{b.label}</p>
                <ul className="text-foreground space-y-1 text-sm">
                  {b.items.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          {/* The trip points the rules above refer to — a rule that says "below
              the minimum sample" is only checkable beside the number itself. */}
          {isObj(cb.thresholds) ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">
                {t("cb.thresholds")}
              </p>
              <KeyValues obj={cb.thresholds as Dict} />
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
      title: t("title.evidenceDocuments"),
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
                      <AutoTranslate text={scalar(doc.title)} />
                    </span>
                    <EvidenceStatusBadge status={status} />
                    <span className="text-muted-foreground ml-auto text-[10px]">
                      {findingCount > 0
                        ? t("findingCount", { count: findingCount })
                        : t("noSummary")}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4 text-xs">
                  {/* Metadata as chips rather than a run-on bullet line. */}
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        [t("col.ref"), doc.sourceReferenceId],
                        [t("col.type"), doc.documentType],
                        [t("col.collected"), doc.collectedDate],
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
                          <AutoTranslate text={String(scalar(ai.evidenceNote))} />
                        </div>
                      ) : null}
                      <div>
                        <p className="text-foreground text-[11px] font-semibold">
                          {t("title.execQualSummary")}
                        </p>
                        <p className="text-muted-foreground mt-0.5 leading-relaxed">
                          <AutoTranslate text={String(scalar(ai.summary))} />
                        </p>
                      </div>
                      {isObjArray(ai.keyFindings) ? (
                        <div>
                          <p className="text-foreground mb-1 text-[11px] font-semibold">
                            {t("title.keyFindings")}
                          </p>
                          <div className="space-y-1.5">
                            {(ai.keyFindings as Dict[]).map(
                              (kf: Dict | string, i: number) => (
                                <div key={i} className="bg-muted/20 rounded border p-2">
                                  <p className="text-foreground font-medium">
                                    <AutoTranslate
                                      text={
                                        typeof kf === "string"
                                          ? kf
                                          : String(scalar(kf.finding))
                                      }
                                    />
                                  </p>
                                  {typeof kf !== "string" &&
                                  (kf.sourceReferenceId || kf.pageOrSection) ? (
                                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                                      {t("refInline", {
                                        ref: String(scalar(kf.sourceReferenceId)),
                                        loc: String(scalar(kf.pageOrSection)),
                                      })}
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
                            {t("title.themes")}
                          </p>
                          <div className="space-y-1.5">
                            {(ai.themes as Dict[]).map((th: Dict | string, i: number) => (
                              <div key={i} className="bg-card rounded border p-2">
                                <p className="text-primary font-semibold">
                                  <AutoTranslate
                                    text={
                                      typeof th === "string"
                                        ? th
                                        : String(scalar(th.theme))
                                    }
                                  />
                                </p>
                                {typeof th !== "string" && th.description ? (
                                  <p className="text-muted-foreground mt-0.5">
                                    <AutoTranslate
                                      text={String(scalar(th.description))}
                                    />
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
                            {t("title.supportingStatements")}
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
                                    <AutoTranslate
                                      text={
                                        typeof st === "string"
                                          ? st
                                          : String(scalar(st.statement))
                                      }
                                    />
                                    &quot;
                                  </p>
                                  {typeof st !== "string" &&
                                  (st.sourceReferenceId ||
                                    st.pageOrSection ||
                                    st.sectionOrPageRef) ? (
                                    <p className="text-muted-foreground mt-0.5 text-[10px]">
                                      {t("refInline", {
                                        ref: String(scalar(st.sourceReferenceId)),
                                        loc: String(
                                          scalar(st.pageOrSection || st.sectionOrPageRef),
                                        ),
                                      })}
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
                            {t("title.risksConcerns")}
                          </p>
                          <div className="space-y-1">
                            {(ai.risksOrConcerns as Dict[]).map(
                              (r: Dict | string, i: number) => (
                                <div
                                  key={i}
                                  className="border-warning/30 bg-warning/10 text-foreground rounded border p-2"
                                >
                                  <p className="font-medium">
                                    <AutoTranslate
                                      text={
                                        typeof r === "string"
                                          ? r
                                          : String(scalar(r.concern))
                                      }
                                    />
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
      title: t("title.combinedSummary"),
      node: (
        <div className="space-y-4 text-xs">
          {typeof cs.executiveSummary === "string" && cs.executiveSummary ? (
            <p className="text-muted-foreground leading-relaxed">
              <AutoTranslate text={cs.executiveSummary} />
            </p>
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
                      {t("title.scoreBasedFindings")}
                    </p>
                    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                      <div className="flex flex-wrap items-center gap-5">
                        {sev !== null ? (
                          <Gauge
                            value={sev}
                            max={100}
                            label={t("gauge.overallSeverity")}
                          />
                        ) : null}
                        {pri !== null ? (
                          <Gauge
                            value={pri}
                            max={100}
                            label={t("priorityScore")}
                            sub={scalar(score.priorityStatus)}
                          />
                        ) : null}
                      </div>
                      {topBars.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs font-medium">
                            {t("col.topDomainsKpis")}
                          </p>
                          <BarChart bars={topBars} max={100} />
                        </div>
                      ) : null}
                    </div>
                    {score.confidenceDataQualityNote ? (
                      <p className="text-muted-foreground border-t pt-3 text-[11px] leading-relaxed">
                        <AutoTranslate text={scalar(score.confidenceDataQualityNote)} />
                      </p>
                    ) : null}
                  </div>
                );
              })()
            : null}

          {isObjArray(cs.documentBasedEvidence) ? (
            <div>
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                {t("title.documentBasedEvidence")}
              </p>
              <div className="space-y-1.5">
                {(cs.documentBasedEvidence as Dict[]).map((e, i) => (
                  <div key={i} className="bg-card rounded border p-2">
                    <p className="text-foreground font-medium">
                      <AutoTranslate text={scalar(e.documentTitle)} />
                    </p>
                    <p className="text-muted-foreground">
                      <AutoTranslate text={scalar(e.keyEvidenceFinding)} />
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {t("refInline", {
                        ref: scalar(e.sourceReferenceId),
                        loc: scalar(e.linkedNeedOrDomain),
                      })}
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
      title: t("title.scoreBasedSummary"),
      node: (
        <div className="space-y-4 text-xs">
          {typeof ss.executiveSummary === "string" && ss.executiveSummary ? (
            <p className="text-muted-foreground leading-relaxed">
              <AutoTranslate text={ss.executiveSummary} />
            </p>
          ) : null}

          {typeof ss.priorityExplanation === "string" && ss.priorityExplanation ? (
            <div className="bg-muted/20 rounded-lg border p-3">
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                {t("title.priorityExplanation")}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <AutoTranslate text={ss.priorityExplanation} />
              </p>
            </div>
          ) : null}

          {isObjArray(ss.keyFindings) ? (
            <div>
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                {t("title.keyFindings")}
              </p>
              <div className="space-y-1.5">
                {(ss.keyFindings as Dict[]).map((f, i) => (
                  <div key={i} className="bg-card rounded border p-2">
                    <p className="text-foreground font-medium">
                      <AutoTranslate text={scalar(f.title)} />
                    </p>
                    <p className="text-muted-foreground">
                      <AutoTranslate text={scalar(f.summary)} />
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {scalar(f.domain)} • {scalar(f.kpi)} •{" "}
                      {t("confidenceInline", { value: scalar(f.confidence) })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isObjArray(ss.domainInsights) ? (
            <div>
              <p className="text-foreground mb-1 text-[11px] font-semibold uppercase">
                {t("title.domainInsights")}
              </p>
              <DataTable rows={ss.domainInsights as Dict[]} />
            </div>
          ) : null}

          {ss.criticalOverrideNote ? (
            <p className="border-warning/30 bg-warning/10 text-foreground rounded border p-2">
              <AutoTranslate text={scalar(ss.criticalOverrideNote)} />
            </p>
          ) : null}

          {ss.dataQualityNote ? (
            <p className="text-muted-foreground">
              <AutoTranslate text={scalar(ss.dataQualityNote)} />
            </p>
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
          {(
            [
              ["keyFindings", t("title.keyFindings")],
              ["dataQualityNote", t("dataQualityNote")],
              ["trendNote", t("trendNote")],
            ] as const
          ).map(([k, heading]) =>
            ai[k] ? (
              <div key={k}>
                <p className="text-muted-foreground text-xs font-medium">{heading}</p>
                <p className="text-foreground text-sm leading-relaxed">
                  <AutoTranslate text={localizeReportText(scalar(ai[k]), locale)} />
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
                  <li key={i}>
                    <AutoTranslate text={scalar(r)} />
                  </li>
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
            <p className="text-foreground text-sm leading-relaxed">
              <AutoTranslate text={dq.narrative} />
            </p>
          ) : null}
          {/* Survey-level cycle-over-cycle note. KEEP IN SYNC with
              dataQualitySections in the backend's report-doc.ts. */}
          {typeof dq.trendNote === "string" && dq.trendNote ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">{t("dq.trend")}</p>
              <p className="text-foreground text-sm leading-relaxed">
                <AutoTranslate text={localizeReportText(dq.trendNote, locale)} />
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
      node: <DataTable rows={c.needRecords} columns={needRecordCols} />,
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
          <AutoTranslate text={scalar(c.dataQualityNote)} />
        </p>
      ),
    });
  }
  if (typeof c.trendNote === "string" && c.trendNote) {
    sections.push({
      title: t("trendNote"),
      node: (
        <p className="text-foreground text-sm leading-relaxed">
          <AutoTranslate text={localizeReportText(scalar(c.trendNote), locale)} />
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
            <li key={i}>
              <AutoTranslate text={scalar(a)} />
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (c.reviewerNotes) {
    sections.push({
      title: t("reviewerNotes"),
      node: (
        <p className="text-foreground text-sm">
          <AutoTranslate text={scalar(c.reviewerNotes)} />
        </p>
      ),
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
      // Was a bare `.toLocaleDateString()` (browser-locale dependent) — the
      // exact class of bug fixed elsewhere in this pass.
      v: formatDate(scalar(header.reportGeneratedAt), locale),
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
            <AutoTranslate text={scalar(header.studyName)} />
          </h1>
          {village ? (
            <p className="text-muted-foreground mt-0.5 text-sm">
              <AutoTranslate text={scalar(village.name)} />
            </p>
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
