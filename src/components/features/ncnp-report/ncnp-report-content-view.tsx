import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { AppLocale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format-date";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { NcnpReport } from "@/services/ncnp-report/ncnp-report.types";
import { KpiDeltaCard } from "./kpi-delta-card";
import { NamedBarList } from "./named-bar-list";
import { PieChart } from "./pie-chart";
import { RegionMap } from "./region-map";
import { ReportPageShell } from "./report-page-shell";
import { Sparkline } from "./sparkline";
import { StatusDonut } from "./status-donut";
import { TrendLineChart } from "./trend-line-chart";
import { TwoStateBar } from "./two-state-bar";

const ORGANIZATION_UNIT_LABEL = ["organization", "organizations"] as const;
// 5 pages match the wireframe; Priority & Scoring is a genuine 6th page —
// added after the client's #1-priority feedback ("priority/scoring output
// entirely absent"), not present in the original 5-page spec, so it gets
// its own real page number rather than being squeezed into or mislabeled
// as a duplicate of Page 5.
const TOTAL_PAGES = 6;

// Top N by count, with a "Showing N of Total" disclosure below — matches
// the PDF export's GEO_CHART_LIMIT/REGION_CHART_LIMIT exactly. A real
// platform can have 15-20+ distinct governorates/centers with linked data,
// which doesn't read well at full length on one page — capped, never
// silently (the true total is always shown). Regions are a small, fixed
// set (13 real KSA regions, max), so that limit is really just "show all".
const GEO_LIST_LIMIT = 10;
const REGION_LIST_LIMIT = 20;

// Matches the Prisma RejectionReasonCode enum's identifiers — UNSPECIFIED
// covers surveys rejected before this field existed (see
// NcnpReportService.buildSurveyAnalytics). Kept in sync manually with the
// PDF export's REJECTION_REASON_LABELS, since the two are separate render
// pipelines.
const REJECTION_REASON_LABELS: Record<string, string> = {
  REJ_01: "Incomplete survey design",
  REJ_02: "Methodology non-compliance",
  REJ_03: "Duplicate of an existing survey",
  REJ_04: "Incorrect need or study linkage",
  REJ_05: "Out-of-scope geography or target population",
  REJ_06: "Data quality concerns",
  REJ_07: "Missing required attachments or approvals",
  REJ_99: "Other",
  UNSPECIFIED: "Unspecified (legacy)",
};

// Display order matches the Prisma AgeBracket enum's declaration order.
const AGE_BRACKET_LABELS: Record<string, string> = {
  age_15_24: "15–24",
  age_25_34: "25–34",
  age_35_44: "35–44",
  age_45_54: "45–54",
  age_55_64: "55–64",
  age_65_plus: "65+",
  prefer_not_to_say: "Prefer not to say",
};
const AGE_BRACKET_ORDER = [
  "age_15_24",
  "age_25_34",
  "age_35_44",
  "age_45_54",
  "age_55_64",
  "age_65_plus",
  "prefer_not_to_say",
];

// Matches the Prisma Gender enum's values.
const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

// Matches the Prisma NeedSource enum's values, in the client's own Report
// Type terminology — see the backend's copy of this same map
// (ncnp-report-pdf.ts) for why 'manual_entry' displays as "Survey" and why
// 'citizen_input'/'field_survey' are kept even though nothing produces them
// yet.
const NEED_SOURCE_LABELS: Record<string, string> = {
  manual_entry: "Survey",
  file_upload: "Uploaded Document",
  citizen_input: "Citizen Input",
  field_survey: "Field Survey",
};

// A validated 7-hue categorical set (CVD-safe adjacent pairs) — the design
// system's own --chart-N tokens only cover 5 slots, which forced two of these
// 7 brackets to repeat a color when cycled. These are scoped to this one
// chart rather than added as new global tokens.
const AGE_BRACKET_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
];

export function formatDate(iso: string, locale: AppLocale): string {
  return formatDateTime(iso, locale);
}

export function reportId(generatedAt: string): string {
  const d = new Date(generatedAt);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `NCNP-${stamp}`;
}

interface SectionLabelProps {
  num: string;
  title: string;
}

function SectionLabel({ num, title }: SectionLabelProps) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-primary font-mono text-xs font-bold">{num}</span>
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      <span className="border-border/60 h-px flex-1 border-t" />
    </div>
  );
}

interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <div className="mb-10">
      {eyebrow ? (
        <p className="text-primary mb-2 text-xs font-bold tracking-wide uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-foreground font-serif text-3xl font-bold tracking-tight">
        {title}
      </h1>
      {description ? (
        <p className="text-muted-foreground mt-3 max-w-[60ch] text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The 6-page compiled report itself — pure presentation, no data fetching.
 * Shared by every place a compiled report is rendered: the live "current
 * data" case and the frozen-snapshot detail-page case share this exact
 * component so there's one render pipeline, not two.
 */
export function NcnpReportContentView({
  report,
  generatedByName,
}: {
  report: NcnpReport;
  generatedByName: string;
}) {
  const t = useTranslations("systemAdmin.ncnpReport");
  const locale = useLocale() as AppLocale;

  const {
    summary,
    orgHealth,
    orgSummary,
    needDomains,
    needSubDomains,
    needsGeography,
    studyStatus,
    publicLinkStatus,
    studyOverview,
    geography,
    surveyAnalytics,
    surveyGeography,
    regionSummary,
    responseAnalytics,
    priorityOverview,
    criticalNeeds,
    dataQualityNotes,
    domainRegionIntersections,
  } = report;

  const disclaimer = t("footerDisclaimer");
  const condensedScope = t("condensedScope", {
    days: summary.newThisPeriod.periodDays,
    region: t("allRegions"),
  });
  const periodLabel = t("periodLabel", { days: summary.newThisPeriod.periodDays });
  const statusByRegionMap = new Map(
    surveyAnalytics.statusByRegion.map((r) => [r.regionId, r.status]),
  );
  const ageBracketCountByKey = new Map(
    responseAnalytics.ageBracketDistribution.map((a) => [a.ageBracket, a.count]),
  );
  const ageBracketTotal = responseAnalytics.ageBracketDistribution.reduce(
    (sum, a) => sum + a.count,
    0,
  );

  const formatCaption = (shown: number, total: number) =>
    t("showingOf", { shown, total });

  return (
    <>
      {/* PAGE 1 — EXECUTIVE SUMMARY */}
      <ReportPageShell
        reportName={t("title")}
        pageOfLabel={t("pageOf", { page: 1, total: TOTAL_PAGES })}
        condensedScope={condensedScope}
        disclaimer={disclaimer}
        masthead={
          <div className="border-border mb-6 border-b-2 pb-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-primary mb-2 text-xs font-bold tracking-wide uppercase">
                  {t("eyebrow")}
                </p>
                <h1 className="text-foreground font-serif text-3xl font-bold tracking-tight">
                  {t("title")}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">{t("doctype")}</p>
                <p className="text-muted-foreground mt-3 max-w-[60ch] text-sm leading-relaxed">
                  {t("description")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="border-border/60 bg-muted/40 mb-2 inline-block rounded-full border px-2.5 py-0.5 font-mono text-xs whitespace-nowrap">
                  {t("pageOf", { page: 1, total: TOTAL_PAGES })}
                </span>
                <p className="text-muted-foreground font-mono text-xs">
                  {t("reportId")}{" "}
                  <span className="text-foreground font-semibold">
                    {reportId(report.generatedAt)}
                  </span>
                </p>
              </div>
            </div>
            <div className="border-border/60 bg-muted/30 mt-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border p-4 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t("scopeReportingPeriod")}:{" "}
                </span>
                <span className="text-foreground font-semibold">
                  {t("scopeReportingPeriodValue", {
                    days: summary.newThisPeriod.periodDays,
                  })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("region")}: </span>
                <span className="text-foreground font-semibold">{t("allRegions")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("scopeGeneratedOn")}: </span>
                <span className="text-foreground font-semibold">
                  {formatDate(report.generatedAt, locale)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("generatedBy")}: </span>
                <span className="text-foreground font-semibold">{generatedByName}</span>
              </div>
            </div>
          </div>
        }
      >
        <section className="mb-8">
          <SectionLabel num="01" title={t("sectionSummary")} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {summary.totals.organizations.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("totalOrganizations")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {summary.totals.studies.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("totalStudies")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {summary.totals.surveys.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("totalPublicSurveys")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {summary.totals.responses.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("totalResponses")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {summary.totals.needs.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("totalNeeds")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {publicLinkStatus.open.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("openSurveys")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {publicLinkStatus.closed.toLocaleString()}
              </p>
              <p className="text-muted-foreground text-xs">{t("closedSurveys")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-3xl font-bold tabular-nums">
                {summary.totals.surveys > 0
                  ? (summary.totals.responses / summary.totals.surveys).toFixed(1)
                  : "0.0"}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("avgResponsesPerSurveyOverall")}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <SectionLabel num="02" title={t("surveyStatusPlatformGrowthTitle")} />
          <StatusDonut
            centerLabel={t("surveysCenterLabel")}
            segments={[
              {
                label: t("surveyDraft"),
                count: surveyAnalytics.statusPlatformWide.draft,
                colorVar: "--muted-foreground",
              },
              {
                label: t("surveySubmitted"),
                count: surveyAnalytics.statusPlatformWide.submitted,
                colorVar: "--warning",
              },
              {
                label: t("surveyPublished"),
                count: surveyAnalytics.statusPlatformWide.published,
                colorVar: "--success",
              },
              {
                label: t("surveyRejected"),
                count: surveyAnalytics.statusPlatformWide.rejected,
                colorVar: "--destructive",
              },
            ]}
          />
        </section>

        <section>
          <SectionLabel num="03" title={t("newThisPeriodTitle")} />
          <p className="text-muted-foreground mb-4 text-xs">
            {t("newThisPeriodCaption")}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiDeltaCard
              label={t("totalOrganizations")}
              total={summary.totals.organizations}
              stat={summary.newThisPeriod.organizations}
              periodLabel={periodLabel}
            />
            <KpiDeltaCard
              label={t("totalStudies")}
              total={summary.totals.studies}
              stat={summary.newThisPeriod.studies}
              periodLabel={periodLabel}
            />
            <KpiDeltaCard
              label={t("totalSurveys")}
              total={summary.totals.surveys}
              stat={summary.newThisPeriod.surveys}
              periodLabel={periodLabel}
            />
            <KpiDeltaCard
              label={t("totalResponses")}
              total={summary.totals.responses}
              stat={summary.newThisPeriod.responses}
              periodLabel={periodLabel}
            />
          </div>
        </section>

        <section className="mt-8">
          <SectionLabel num="04" title={t("topCriticalNeedsTitle")} />
          {criticalNeeds.topCriticalNeeds.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("topCriticalNeedsEmpty")}</p>
          ) : (
            <>
              <p className="text-muted-foreground mb-4 text-xs">
                {t("topCriticalNeedsCaption", {
                  rankable: criticalNeeds.totalRankableNeeds,
                  total: criticalNeeds.totalNeeds,
                })}
              </p>
              <ul className="space-y-3">
                {criticalNeeds.topCriticalNeeds.map((n, i) => (
                  <li
                    key={n.needId}
                    className="border-border/60 bg-muted/20 flex items-start justify-between gap-4 rounded-xl border p-4"
                  >
                    <div>
                      <p className="text-foreground text-sm font-semibold">
                        {i + 1}. {n.needTitle}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {[
                          n.organizationName,
                          n.domain,
                          n.primaryGap
                            ? t("primaryGapLabel", { gap: n.primaryGap })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant={
                          n.priorityStatus === "HIGH" ? "destructive" : "secondary"
                        }
                      >
                        {n.priorityStatus}
                      </Badge>
                      <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">
                        {n.priorityScore.toFixed(1)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </ReportPageShell>

      {/* PAGE 2 — ORGANIZATION OVERVIEW */}
      <ReportPageShell
        reportName={t("title")}
        pageOfLabel={t("pageOf", { page: 2, total: TOTAL_PAGES })}
        condensedScope={condensedScope}
        disclaimer={disclaimer}
      >
        <PageHeading
          eyebrow={t("pageLabel", { page: 2 })}
          title={t("page2Title")}
          description={t("page2Description", { count: summary.totals.organizations })}
        />

        <section className="mb-10">
          <SectionLabel num="01" title={t("sectionGeography")} />
          <div className="border-border/60 bg-muted/20 mb-4 rounded-xl border p-4">
            <p className="text-foreground mb-1 text-sm font-semibold">
              {t("kingdomMap")}
            </p>
            <p className="text-muted-foreground mb-4 text-xs">{t("kingdomMapNote")}</p>
            <RegionMap
              data={geography.organizationsByRegion}
              unitLabel={ORGANIZATION_UNIT_LABEL}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("orgsByRegion")}
              </p>
              <NamedBarList
                items={geography.organizationsByRegion}
                limit={REGION_LIST_LIMIT}
                emptyText={t("geographyEmpty")}
                formatCaption={formatCaption}
              />
            </div>
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("orgsByGovernorate")}
              </p>
              <NamedBarList
                items={geography.organizationsByGovernorate}
                limit={GEO_LIST_LIMIT}
                emptyText={t("geographyEmpty")}
                formatCaption={formatCaption}
              />
            </div>
          </div>
          <div className="mt-6">
            <p className="text-foreground mb-3 text-sm font-semibold">
              {t("orgsByCenter")}
            </p>
            <NamedBarList
              items={geography.organizationsByCenter}
              limit={GEO_LIST_LIMIT}
              emptyText={t("geographyEmpty")}
              formatCaption={formatCaption}
            />
          </div>
        </section>

        <section className="mb-10">
          <SectionLabel num="02" title={t("sectionOrgHealth")} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="border-border/60 bg-muted/20 flex flex-wrap gap-6 rounded-xl border p-4">
              <div>
                <p className="text-foreground text-2xl font-bold tabular-nums">
                  {orgHealth.active}
                </p>
                <p className="text-muted-foreground text-xs">{t("orgActive")}</p>
              </div>
              <div>
                <p className="text-foreground text-2xl font-bold tabular-nums">
                  {orgHealth.inactive}
                </p>
                <p className="text-muted-foreground text-xs">{t("orgInactive")}</p>
              </div>
              <div>
                <p className="text-warning text-2xl font-bold tabular-nums">
                  {orgHealth.dormant}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("orgDormant", { days: orgHealth.dormantDays })}
                </p>
              </div>
            </div>
            <div>
              <p className="text-foreground mb-2 text-sm font-semibold">
                {t("needsAttentionTitle")}
              </p>
              <div className="mb-3">
                <TwoStateBar
                  primaryLabel={t("orgHealthy")}
                  primaryCount={Math.max(
                    0,
                    orgHealth.active - orgHealth.needsAttention.length,
                  )}
                  secondaryLabel={t("orgFlagged")}
                  secondaryCount={orgHealth.needsAttention.length}
                />
              </div>
              {orgHealth.needsAttention.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t("needsAttentionEmpty")}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {orgHealth.needsAttention.slice(0, 5).map((o) => (
                    <li
                      key={o.organizationId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground">{o.organizationName}</span>
                      <span className="text-muted-foreground text-xs">
                        {o.lastActivity
                          ? formatDate(o.lastActivity, locale)
                          : t("lastActivityUnknown")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section>
          <SectionLabel num="03" title={t("orgSummaryTitle")} />
          <p className="text-muted-foreground mb-4 text-xs">{t("orgSummaryCaption")}</p>

          <p className="text-foreground mb-3 text-sm font-semibold">
            {t("orgSummaryByStudies")}
          </p>
          <NamedBarList
            items={orgSummary.byStudies.map((r) => ({
              id: r.organizationId,
              name: r.organizationName,
              count: r.studyCount,
            }))}
            limit={orgSummary.byStudies.length}
            emptyText={t("noDataAvailable")}
          />
          {orgSummary.byStudies.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs italic">
              {t("showingOf", {
                shown: orgSummary.byStudies.length,
                total: orgSummary.totalOrganizations,
              })}
            </p>
          ) : null}

          <p className="text-foreground mt-6 mb-3 text-sm font-semibold">
            {t("orgSummaryBySurveys")}
          </p>
          <NamedBarList
            items={orgSummary.bySurveys.map((r) => ({
              id: r.organizationId,
              name: r.organizationName,
              count: r.surveyCount,
            }))}
            limit={orgSummary.bySurveys.length}
            emptyText={t("noDataAvailable")}
          />
          {orgSummary.bySurveys.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs italic">
              {t("showingOf", {
                shown: orgSummary.bySurveys.length,
                total: orgSummary.totalOrganizations,
              })}
            </p>
          ) : null}

          <p className="text-foreground mt-6 mb-3 text-sm font-semibold">
            {t("orgSummaryByResponses")}
          </p>
          <NamedBarList
            items={orgSummary.byResponses.map((r) => ({
              id: r.organizationId,
              name: r.organizationName,
              count: r.responseCount,
            }))}
            limit={orgSummary.byResponses.length}
            emptyText={t("noDataAvailable")}
          />
          {orgSummary.byResponses.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs italic">
              {t("showingOf", {
                shown: orgSummary.byResponses.length,
                total: orgSummary.totalOrganizations,
              })}
            </p>
          ) : null}
        </section>
      </ReportPageShell>

      {/* PAGE 3 — STUDY OVERVIEW */}
      <ReportPageShell
        reportName={t("title")}
        pageOfLabel={t("pageOf", { page: 3, total: TOTAL_PAGES })}
        condensedScope={condensedScope}
        disclaimer={disclaimer}
      >
        <PageHeading
          eyebrow={t("pageLabel", { page: 3 })}
          title={t("page3Title")}
          description={t("page3Description", { count: summary.totals.studies })}
        />

        <section className="mb-10">
          <SectionLabel num="01" title={t("needCategoriesStudyStatusTitle")} />
          <p className="text-foreground mb-1 text-sm font-semibold">
            {t("sectionNeedDomains")}
          </p>
          <p className="text-muted-foreground mb-4 text-xs">{t("needDomainsNote")}</p>
          <NamedBarList
            items={needDomains.map((d) => ({
              id: d.domainCode,
              name: d.domainName,
              count: d.needCount,
            }))}
            limit={needDomains.length}
            emptyText={t("noDataAvailable")}
          />
          <p className="text-foreground mt-6 mb-4 text-sm font-semibold">
            {t("sectionStudyStatus")}
          </p>
          <TwoStateBar
            primaryLabel={t("studyActive")}
            primaryCount={studyStatus.active}
            secondaryLabel={t("studyArchived")}
            secondaryCount={studyStatus.archived}
          />
        </section>

        <section className="mb-10">
          <SectionLabel num="02" title={t("studiesByRegion")} />
          <NamedBarList
            items={geography.studiesByRegion}
            emptyText={t("geographyEmpty")}
            formatCaption={formatCaption}
          />
        </section>

        <section className="mb-10">
          <SectionLabel num="03" title={t("topOrgsByStudyCount")} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("orgSummaryColOrg")}</TableHead>
                  <TableHead className="text-right">
                    {t("orgSummaryColStudies")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studyOverview.topOrgsByStudyCount.map((o) => (
                  <TableRow key={o.organizationId}>
                    <TableCell className="font-medium">{o.organizationName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.studyCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {studyOverview.topOrgsByStudyCount.length > 0 ? (
              <p className="text-muted-foreground mt-3 text-xs italic">
                {t("showingOf", {
                  shown: studyOverview.topOrgsByStudyCount.length,
                  total: studyOverview.totalOrganizations,
                })}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mb-10">
          <SectionLabel num="04" title={t("studiesCreatedTrend")} />
          <TrendLineChart
            points={studyOverview.studiesCreatedTrend}
            emptyText={t("noDataAvailable")}
          />
        </section>

        <section className="mb-10">
          <SectionLabel num="05" title={t("needsGeographyTitle")} />
          <p className="text-muted-foreground mb-4 text-xs">{t("needsGeographyNote")}</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("needsByRegion")}
              </p>
              <NamedBarList
                items={needsGeography.byRegion}
                limit={REGION_LIST_LIMIT}
                emptyText={t("geographyEmpty")}
                formatCaption={formatCaption}
              />
            </div>
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("needsByGovernorate")}
              </p>
              <NamedBarList
                items={needsGeography.byGovernorate}
                limit={GEO_LIST_LIMIT}
                emptyText={t("geographyEmpty")}
                formatCaption={formatCaption}
              />
            </div>
          </div>
          <div className="mt-6">
            <p className="text-foreground mb-3 text-sm font-semibold">
              {t("needsByCenter")}
            </p>
            <NamedBarList
              items={needsGeography.byCenter}
              limit={GEO_LIST_LIMIT}
              emptyText={t("geographyEmpty")}
              formatCaption={formatCaption}
            />
          </div>
        </section>

        <section className="mb-10">
          <SectionLabel num="06" title={t("needsBySubDomainTitle")} />
          <NamedBarList
            items={needSubDomains.map((d, i) => ({
              id: `${d.domainName}-${d.subDomainName}-${i}`,
              name: `${d.domainName} — ${d.subDomainName}`,
              count: d.needCount,
            }))}
            limit={GEO_LIST_LIMIT}
            emptyText={t("noDataAvailable")}
            formatCaption={formatCaption}
          />
        </section>

        <section>
          <SectionLabel num="07" title={t("patternIntersectionTitle")} />
          <p className="text-muted-foreground mb-4 text-xs">
            {t("patternIntersectionNote")}
          </p>
          {domainRegionIntersections.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noDataAvailable")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("region")}</TableHead>
                    <TableHead>{t("domainColumn")}</TableHead>
                    <TableHead className="text-right">{t("needsColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domainRegionIntersections.map((c, i) => (
                    <TableRow key={`${c.regionName}-${c.domainName}-${i}`}>
                      <TableCell className="font-medium">{c.regionName}</TableCell>
                      <TableCell>{c.domainName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.needCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </ReportPageShell>

      {/* PAGE 4 — PUBLIC SURVEY OVERVIEW */}
      <ReportPageShell
        reportName={t("title")}
        pageOfLabel={t("pageOf", { page: 4, total: TOTAL_PAGES })}
        condensedScope={condensedScope}
        disclaimer={disclaimer}
      >
        <PageHeading
          eyebrow={t("pageLabel", { page: 4 })}
          title={t("page4Title")}
          description={t("page4Description", { count: summary.totals.surveys })}
        />

        <section className="mb-8">
          <SectionLabel num="01" title={t("surveyApprovalAvgYieldTitle")} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-foreground mb-4 text-sm font-semibold">
                {t("surveyStatusPlatformWide")}
              </p>
              <StatusDonut
                centerLabel={t("sectionSurveys")}
                segments={[
                  {
                    label: t("surveyDraft"),
                    count: surveyAnalytics.statusPlatformWide.draft,
                    colorVar: "--muted-foreground",
                  },
                  {
                    label: t("surveySubmitted"),
                    count: surveyAnalytics.statusPlatformWide.submitted,
                    colorVar: "--warning",
                  },
                  {
                    label: t("surveyPublished"),
                    count: surveyAnalytics.statusPlatformWide.published,
                    colorVar: "--success",
                  },
                  {
                    label: t("surveyRejected"),
                    count: surveyAnalytics.statusPlatformWide.rejected,
                    colorVar: "--destructive",
                  },
                ]}
              />
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-foreground text-4xl font-extrabold tabular-nums">
                {surveyAnalytics.avgResponsesPerPublishedSurvey.toFixed(1)}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("avgResponsesPerSurvey")}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Sparkline points={responseAnalytics.monthlyTrend.map((p) => p.count)} />
                <span className="text-muted-foreground text-xs">
                  {t("last12MonthsShort")}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <SectionLabel num="02" title={t("rejectionReasonsTitle")} />
          {surveyAnalytics.rejectionReasonBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("rejectionReasonsEmpty")}</p>
          ) : (
            <NamedBarList
              items={surveyAnalytics.rejectionReasonBreakdown.map((r) => ({
                id: r.reasonCode,
                name: `${r.reasonCode} — ${REJECTION_REASON_LABELS[r.reasonCode] ?? r.reasonCode}`,
                count: r.count,
              }))}
              limit={surveyAnalytics.rejectionReasonBreakdown.length}
              emptyText={t("rejectionReasonsEmpty")}
            />
          )}
        </section>

        <section className="mb-8">
          <SectionLabel num="03" title={t("sectionGeography")} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("surveysByRegionTitle")}
              </p>
              <NamedBarList
                items={surveyGeography.byRegion}
                limit={REGION_LIST_LIMIT}
                emptyText={t("geographyEmpty")}
                formatCaption={formatCaption}
              />
            </div>
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("surveysByGovernorate")}
              </p>
              <NamedBarList
                items={surveyGeography.byGovernorate}
                limit={GEO_LIST_LIMIT}
                emptyText={t("geographyEmpty")}
                formatCaption={formatCaption}
              />
            </div>
          </div>
          <div className="mt-6">
            <p className="text-foreground mb-3 text-sm font-semibold">
              {t("surveysByCenter")}
            </p>
            <NamedBarList
              items={surveyGeography.byCenter}
              limit={GEO_LIST_LIMIT}
              emptyText={t("geographyEmpty")}
              formatCaption={formatCaption}
            />
          </div>
        </section>

        <section>
          <SectionLabel num="04" title={t("regionSummaryTitle")} />
          <p className="text-muted-foreground mb-4 text-xs">
            {t("regionSummaryCaption")}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("regionSummaryColRegion")}</TableHead>
                  <TableHead className="text-right">
                    {t("regionSummaryColSurveys")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("regionSummaryColResponses")}
                  </TableHead>
                  <TableHead className="text-right">{t("regionSummaryColAvg")}</TableHead>
                  <TableHead className="text-right">{t("surveyDraft")}</TableHead>
                  <TableHead className="text-right">{t("surveySubmitted")}</TableHead>
                  <TableHead className="text-right">{t("surveyPublished")}</TableHead>
                  <TableHead className="text-right">{t("surveyRejected")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regionSummary.map((r) => {
                  const status = statusByRegionMap.get(r.regionId);
                  return (
                    <TableRow key={r.regionId}>
                      <TableCell className="font-medium">{r.regionName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.surveyCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.responseCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.avgResponsesPerSurvey.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {status?.draft ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {status?.submitted ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {status?.published ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {status?.rejected ?? 0}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      </ReportPageShell>

      {/* PAGE 5 — RESPONSE ANALYTICS */}
      <ReportPageShell
        reportName={t("title")}
        pageOfLabel={t("pageOf", { page: 5, total: TOTAL_PAGES })}
        condensedScope={condensedScope}
        disclaimer={disclaimer}
      >
        <PageHeading
          eyebrow={t("pageLabel", { page: 5 })}
          title={t("page5Title")}
          description={t("page5Description")}
        />

        <section className="mb-8">
          <SectionLabel num="01" title={t("sectionResponses")} />
          <p className="text-foreground mb-4 text-sm font-semibold">
            {t("responseTrend")}
          </p>
          <TrendLineChart
            points={responseAnalytics.monthlyTrend}
            emptyText={t("noDataAvailable")}
          />
        </section>

        <section className="mb-8">
          <SectionLabel num="02" title={t("geographicPerformanceTitle")} />
          <p className="text-foreground mb-3 text-sm font-semibold">
            {t("responsesByRegion")}
          </p>
          <NamedBarList
            items={responseAnalytics.responsesByRegion.map((r) => ({
              id: r.regionId,
              name: r.regionName,
              count: r.count,
            }))}
            emptyText={t("noDataAvailable")}
            formatCaption={formatCaption}
          />
        </section>

        <section className="mb-8">
          <SectionLabel num="03" title={t("orgResponsePerformanceTitle")} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("topOrgsByTotal")}
              </p>
              <NamedBarList
                items={responseAnalytics.topOrgsByTotalResponses.map((o) => ({
                  id: o.organizationId,
                  name: o.organizationName,
                  count: o.value,
                }))}
                emptyText={t("noDataAvailable")}
              />
              {responseAnalytics.topOrgsByTotalResponses.length > 0 ? (
                <p className="text-muted-foreground mt-3 text-xs italic">
                  {t("showingOf", {
                    shown: responseAnalytics.topOrgsByTotalResponses.length,
                    total: summary.totals.organizations,
                  })}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-foreground mb-3 text-sm font-semibold">
                {t("topOrgsByAvg")}
              </p>
              <NamedBarList
                items={responseAnalytics.topOrgsByAvgResponsesPerSurvey.map((o) => ({
                  id: o.organizationId,
                  name: o.organizationName,
                  count: Math.round(o.value * 10) / 10,
                }))}
                emptyText={t("noDataAvailable")}
              />
              {responseAnalytics.topOrgsByAvgResponsesPerSurvey.length > 0 ? (
                <p className="text-muted-foreground mt-3 text-xs italic">
                  {t("showingOf", {
                    shown: responseAnalytics.topOrgsByAvgResponsesPerSurvey.length,
                    total: summary.totals.organizations,
                  })}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section>
          <SectionLabel num="04" title={t("demographicsTitle")} />
          <p className="text-foreground mb-4 text-sm font-semibold">
            {t("genderDistribution")}
          </p>
          <StatusDonut
            centerLabel={t("genderDistribution")}
            // AGE_BRACKET_COLORS, not --chart-N — two adjacent --chart
            // tokens (steel blue-gray, sage green) read too close in
            // hue/lightness to tell apart, which is exactly what happened
            // with Female/Male. Reusing the same validated, CVD-safe
            // categorical set Age Distribution already uses.
            segments={responseAnalytics.genderDistribution.map((g, i) => ({
              label: GENDER_LABELS[g.gender] ?? g.gender,
              count: g.count,
              colorVar: AGE_BRACKET_COLORS[i % AGE_BRACKET_COLORS.length]!,
            }))}
          />
          <p className="text-foreground mt-6 mb-1 text-sm font-semibold">
            {t("ageDistribution")}
          </p>
          {responseAnalytics.hasResponsesWithoutAgeBracket ? (
            <p className="text-muted-foreground mb-4 text-xs">
              {t("ageDistributionHistoricalNote")}
            </p>
          ) : null}
          {ageBracketTotal === 0 ? (
            <p className="text-muted-foreground text-sm">{t("ageDistributionEmpty")}</p>
          ) : (
            <PieChart
              slices={AGE_BRACKET_ORDER.filter(
                (key) => (ageBracketCountByKey.get(key) ?? 0) > 0,
              ).map((key, i) => ({
                label: AGE_BRACKET_LABELS[key] ?? key,
                count: ageBracketCountByKey.get(key) ?? 0,
                color: AGE_BRACKET_COLORS[i % AGE_BRACKET_COLORS.length]!,
              }))}
            />
          )}
        </section>
      </ReportPageShell>

      {/* Priority & Scoring — not in the original 5-page wireframe; added as
          its own Page 6 after the client's #1-priority feedback ("priority/
          scoring output entirely absent"). */}
      <ReportPageShell
        reportName={t("title")}
        pageOfLabel={t("pageOf", { page: 6, total: TOTAL_PAGES })}
        condensedScope={condensedScope}
        disclaimer={disclaimer}
      >
        <PageHeading
          eyebrow={t("pageLabel", { page: 6 })}
          title={t("sectionPriority")}
          description={t("priorityPageDescription")}
        />
        <section className="mb-8">
          <SectionLabel num="01" title={t("priorityByStatus")} />
          <StatusDonut
            centerLabel={t("priorityByStatus")}
            segments={priorityOverview.byStatus.map((s) => ({
              label: s.status,
              count: s.count,
              colorVar:
                s.status === "HIGH"
                  ? "--destructive"
                  : s.status === "MEDIUM"
                    ? "--warning"
                    : "--success",
            }))}
          />
        </section>
        <section className="mb-8">
          <SectionLabel num="02" title={t("domainComparison")} />
          <p className="text-muted-foreground -mt-2 mb-4 text-xs">
            {t("domainComparisonNote")}
          </p>
          <NamedBarList
            items={priorityOverview.domainComparison.map((d) => ({
              id: d.domainKey,
              name: d.domainName,
              count: Math.round(d.avgPerformanceScore),
            }))}
            limit={priorityOverview.domainComparison.length}
            emptyText={t("noDataAvailable")}
          />
        </section>
        <section className="mb-8">
          <SectionLabel num="03" title={t("topPriorityVillages")} />
          {priorityOverview.topPriorityVillages.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("topPriorityVillagesEmpty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("villageColumn")}</TableHead>
                  <TableHead className="text-right">{t("priorityScoreColumn")}</TableHead>
                  <TableHead className="text-right">
                    {t("priorityStatusColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityOverview.topPriorityVillages.map((v) => (
                  <TableRow key={`${v.studyId}-${v.surveyId}-${v.villageId}`}>
                    <TableCell className="font-medium">{v.villageId}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.priorityScore.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          v.priorityStatus === "HIGH" ? "destructive" : "secondary"
                        }
                      >
                        {v.priorityStatus}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="mb-8">
          <SectionLabel num="04" title={t("priorityNeedsTitle")} />
          <p className="text-muted-foreground mb-4 text-xs">{t("priorityNeedsNote")}</p>
          {criticalNeeds.priorityNeeds.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("priorityNeedsEmpty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("needColumn")}</TableHead>
                    <TableHead>{t("domainColumn")}</TableHead>
                    <TableHead className="text-right">
                      {t("priorityScoreColumn")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("priorityStatusColumn")}
                    </TableHead>
                    <TableHead className="text-right">{t("equityFlagColumn")}</TableHead>
                    <TableHead>{t("primaryGapColumn")}</TableHead>
                    <TableHead>{t("indicatorColumn")}</TableHead>
                    <TableHead>{t("unitGeoColumn")}</TableHead>
                    <TableHead className="text-right">{t("evidenceColumn")}</TableHead>
                    <TableHead>{t("sourceColumn")}</TableHead>
                    <TableHead>{t("sourceRefColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalNeeds.priorityNeeds.map((n) => (
                    <TableRow key={n.needId}>
                      <TableCell className="font-medium">{n.needTitle}</TableCell>
                      <TableCell>{n.domain ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n.priorityScore.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            n.priorityStatus === "HIGH" ? "destructive" : "secondary"
                          }
                        >
                          {n.priorityStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {n.equityFlag ? t("yes") : t("no")}
                        </Badge>
                      </TableCell>
                      <TableCell>{n.primaryGap ?? "—"}</TableCell>
                      <TableCell>{n.indicatorId ?? "—"}</TableCell>
                      <TableCell>{n.unitGeoRegion ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {n.evidenceCount}
                      </TableCell>
                      <TableCell>{NEED_SOURCE_LABELS[n.source] ?? n.source}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {n.sourceRef ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {criticalNeeds.totalRankableNeeds > criticalNeeds.priorityNeeds.length ? (
                <p className="text-muted-foreground mt-3 text-xs italic">
                  {t("showingOf", {
                    shown: criticalNeeds.priorityNeeds.length,
                    total: criticalNeeds.totalRankableNeeds,
                  })}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section>
          <SectionLabel num="05" title={t("dataQualityNotesTitle")} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {dataQualityNotes.assessedResponses} / {dataQualityNotes.totalResponses}
              </p>
              <p className="text-muted-foreground text-xs">{t("responsesAssessed")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {dataQualityNotes.lowConfidenceCount}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("lowConfidenceResponses")}
              </p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {dataQualityNotes.duplicateFlaggedCount}
              </p>
              <p className="text-muted-foreground text-xs">
                {t("duplicateFlaggedResponses")}
              </p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {dataQualityNotes.needsWithEvidence} / {dataQualityNotes.totalNeeds}
              </p>
              <p className="text-muted-foreground text-xs">{t("needsWithEvidence")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {dataQualityNotes.needsWithoutEvidence}
              </p>
              <p className="text-muted-foreground text-xs">{t("needsWithoutEvidence")}</p>
            </div>
            <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {dataQualityNotes.needsUnclassified}
              </p>
              <p className="text-muted-foreground text-xs">{t("needsUnclassified")}</p>
            </div>
          </div>
          {dataQualityNotes.assessedResponses === 0 ? (
            <p className="text-muted-foreground mt-4 text-xs italic">
              {t("dataQualityNotesEmpty")}
            </p>
          ) : null}
        </section>
      </ReportPageShell>

      <div className="text-muted-foreground border-border mt-4 flex items-center justify-between border-t-2 pt-4 text-xs">
        <div className="flex gap-6">
          <span className="flex flex-col">
            <span>
              <b className="text-foreground text-base tabular-nums">
                {summary.totals.organizations.toLocaleString()}
              </b>{" "}
              {t("totalOrganizations")}
              <span className="text-success ml-1 font-semibold tabular-nums">
                (+{summary.newThisPeriod.organizations.current.toLocaleString()})
              </span>
            </span>
            <span className="text-muted-foreground/80 text-[10px]">
              {t("vsPreviousPeriod")}
            </span>
          </span>
          <span className="flex flex-col">
            <span>
              <b className="text-foreground text-base tabular-nums">
                {summary.totals.studies.toLocaleString()}
              </b>{" "}
              {t("totalStudies")}
              <span className="text-success ml-1 font-semibold tabular-nums">
                (+{summary.newThisPeriod.studies.current.toLocaleString()})
              </span>
            </span>
            <span className="text-muted-foreground/80 text-[10px]">
              {t("vsPreviousPeriod")}
            </span>
          </span>
          <span className="flex flex-col">
            <span>
              <b className="text-foreground text-base tabular-nums">
                {summary.totals.surveys.toLocaleString()}
              </b>{" "}
              {t("totalSurveys")}
              <span className="text-success ml-1 font-semibold tabular-nums">
                (+{summary.newThisPeriod.surveys.current.toLocaleString()})
              </span>
            </span>
            <span className="text-muted-foreground/80 text-[10px]">
              {t("vsPreviousPeriod")}
            </span>
          </span>
          <span className="flex flex-col">
            <span>
              <b className="text-foreground text-base tabular-nums">
                {summary.totals.responses.toLocaleString()}
              </b>{" "}
              {t("totalResponses")}
              <span className="text-success ml-1 font-semibold tabular-nums">
                (+{summary.newThisPeriod.responses.current.toLocaleString()})
              </span>
            </span>
            <span className="text-muted-foreground/80 text-[10px]">
              {t("vsPreviousPeriod")}
            </span>
          </span>
        </div>
        <span>
          {t("generatedBy")}: {generatedByName} · {reportId(report.generatedAt)}
        </span>
      </div>
    </>
  );
}
