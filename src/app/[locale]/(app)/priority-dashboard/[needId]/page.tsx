"use client";

import { Gauge, ListChecks, AlertTriangle } from "lucide-react";
import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn, formatDomainSummary } from "@/lib/utils";
import { BackButton } from "@/components/common/back-button";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { PriorityBreakdown } from "@/components/features/priority/priority-breakdown";
import { priorityService } from "@/services/priority/priority.service";
import type { PriorityScore } from "@/services/priority/priority.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { actAsOrgOptions } from "@/lib/act-as-org";
import { ApiError } from "@/services/api/types";
import type { PublicSurveyLink } from "@/services/public-surveys/public-surveys.types";
import { responseQualityService } from "@/services/response-quality/response-quality.service";
import type { ResponseQualityResult } from "@/services/response-quality/response-quality.types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studyConfigService } from "@/services/study-config/study-config.service";
import type { StudyConfigOption } from "@/services/study-config/study-config.types";
import type { Survey } from "@/services/surveys/surveys.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityDashboard } from "@/components/features/insights/severity-dashboard";
import {
  severityScoringService,
  VillagePriorityResult,
} from "@/services/priority/severity-scoring.service";
import { AiPrioritySummaryPanel } from "@/components/features/insights/ai-priority-summary-panel";
import { SupportingEvidencePanel } from "@/components/features/insights/supporting-evidence-panel";
import { DocumentBasedSummaryTab } from "@/components/features/priority/document-based-summary-tab";
import { CombinedSummaryTab } from "@/components/features/priority/combined-summary-tab";
import { NeedDecisionsPanel } from "@/components/features/priority/need-decisions-panel";
import { loadPriorityInsights, loadSurveyLinks } from "./load-insights";

const CONSOLIDATED = "consolidated";
const NONE = "none";

// RIO-FR-005 criterion 1 (Score Components card, "priority" tab below) —
// Urgency and Theme have no backend field yet: Urgency is part of
// RIO-FR-003's scoring engine (not yet built — see the master clarification
// log), and Theme is a separate, also-unbuilt AI capability ("Recurring
// theme extraction", client-confirmed Round 1 Q24: free-text per Need, not a
// score). These are the only two hardcoded values on this page — replace
// both the instant real fields/endpoints exist; nothing else needs to
// change, since Severity (`priorityV2.priorityStatus`) and Affected Group
// Size (`need.affectedPeople`/`affectedHouseholds`) already read real data.
const PLACEHOLDER_URGENCY = "High";
const PLACEHOLDER_THEME = "Water access";

export default function PriorityDetailInsightsPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("PriorityDashboard.detailPage");
  const { localizedDomain } = useDomainArabicMap();
  // Client-confirmed (Aug 14): Quality Assessment is Data Analyst's action —
  // was aiReview:write (shared with Research Officer's unrelated Need-
  // classification-trigger use of that flag). Reuses canScore
  // (priorityScoring:create), the same gate the Recalculate button below
  // already uses — both are Data-Analyst-only "run a new analysis" actions.
  const canScore = usePermission("priorityScoring", "create");
  // RIO-FR-005 (Q12) — analyst-entered, gated to the same permission the
  // backend's PATCH needs/:needId/gap-type route checks.
  const canEditGapType = usePermission("priorityScoring", "write");
  const [savingGapType, setSavingGapType] = useState(false);
  const [gapTypeOptions, setGapTypeOptions] = useState<StudyConfigOption[]>([]);

  useEffect(() => {
    studyConfigService
      .listGapTypes()
      .then((options) => setGapTypeOptions(options.filter((o) => o.isActive)))
      .catch(() => undefined);
  }, []);

  async function handleGapTypeChange(value: string) {
    const nextGapType = value === NONE ? null : value;
    setSavingGapType(true);
    try {
      const updated = await needsService.setGapType(needId, nextGapType);
      setNeed(updated);
    } finally {
      setSavingGapType(false);
    }
  }

  const [links, setLinks] = useState<PublicSurveyLink[]>([]);
  const [scope, setScope] = useState<string>(CONSOLIDATED);
  const surveyLinkId = scope === CONSOLIDATED ? undefined : scope;

  const [qualityResults, setQualityResults] = useState<ResponseQualityResult[] | null>(
    null,
  );
  const [priorityV2, setPriorityV2] = useState<VillagePriorityResult | null>(null);
  const [need, setNeed] = useState<Need | null>(null);
  // RIO-FR-003 — the explainable nine-factor score, separate from the
  // village-level PriorityV2 assessment rendered below it. The two answer
  // different questions (this need vs this village) and have opposite
  // polarity, so they are deliberately shown as two panels, not merged.
  const [needScore, setNeedScore] = useState<PriorityScore | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assessing, setAssessing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [summaryKey, setSummaryKey] = useState(0);

  // RIO-FR-003 — load any existing per-need score so the breakdown is there
  // before the reviewer presses Recalculate. Silent on failure: a need that
  // has never been scored legitimately has none.
  useEffect(() => {
    let stale = false;
    priorityService
      .getLatest(needId)
      .then((s) => {
        if (!stale) setNeedScore(s);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [needId]);

  useEffect(() => {
    let stale = false;
    loadSurveyLinks(needId, () => stale, setLinks);
    return () => {
      stale = true;
    };
  }, [needId]);

  // `needId` (route param) and `surveyLinkId` (scope filter) can both change
  // while a previous loadPriorityInsights() from an earlier value is still
  // in flight — e.g. switching the Scope Filter twice in quick succession.
  // See load-insights.ts's own comment for how the stale guard prevents an
  // obsolete request from overwriting state a newer one already produced.
  useEffect(() => {
    let stale = false;
    loadPriorityInsights(needId, surveyLinkId, () => stale, {
      setNeed,
      setSurvey,
      setPriorityV2,
      setQualityResults,
    });
    return () => {
      stale = true;
    };
  }, [needId, surveyLinkId]);

  async function handleAssess() {
    setAssessing(true);
    setError(null);
    try {
      const results = await responseQualityService.assess(needId, surveyLinkId);
      setQualityResults(results);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to assess response quality",
      );
    } finally {
      setAssessing(false);
    }
  }

  async function handleScore() {
    // Unlike Tab 1, this button lives outside the `survey ? ... : ...` branch
    // that hides the rest of the page when the Need has no PUBLISHED survey,
    // so it is clickable with `survey === null`. Reporting that is the whole
    // point — an early `return` here made the click a complete no-op: no
    // spinner, no error, and the panel still reading "No priority score
    // calculated for this need yet."
    if (!survey) {
      setError(t("noPublishedSurvey"));
      return;
    }
    setScoring(true);
    setError(null);
    try {
      const options = actAsOrgOptions(need?.orgId);
      const outcome = await severityScoringService.recalculate(
        survey.studyId,
        survey.id,
        options,
      );
      const result = await severityScoringService.getVillagePriority(
        survey.studyId,
        survey.id,
        null,
        options,
      );
      setPriorityV2(result);
      // RIO-FR-003 — the per-need explainable score is produced by its own
      // endpoint, so recalculating the rollups is not enough on its own.
      setNeedScore(await priorityService.score(needId, undefined, options));
      setSummaryKey((prev) => prev + 1); // trigger refresh of AI summary state
      // A run can succeed as an HTTP call and still compute nothing (no
      // responses submitted yet, methodology reference data missing). Say
      // which, rather than leaving the panel looking unchanged.
      if (!result) {
        setError(
          outcome.reason
            ? t(`recalculateReason.${outcome.reason}`)
            : t("recalculateReason.NO_RESULT"),
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("recalculateError"));
    } finally {
      setScoring(false);
    }
  }

  const criticalOverrides = (priorityV2?.domainComponents || []).filter(
    (d) => d.triggeredOverride || d.isCriticalDomain,
  );

  return (
    <PermissionGuard module="priorityScoring" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/priority-dashboard" label={t("backToDashboard")} />
        </div>

        <PageHeader
          title={
            need?.title ? t("titleSuffix", { title: need.title }) : t("titleFallback")
          }
          description={
            need?.allDomainsSelected
              ? t("domainAll")
              : need && need.needDomains.length > 0
                ? t("domainList", {
                    domains: formatDomainSummary(
                      need.needDomains.map((d: { domain: string }) => d.domain),
                    ),
                  })
                : need?.domain
                  ? t("domainSingle", { domain: need.domain })
                  : t("descriptionFallback")
          }
          actions={
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">
                {t("scopeFilter")}
              </span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-full sm:w-64" aria-label={t("scopeFilter")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CONSOLIDATED}>{t("consolidated")}</SelectItem>
                  {links.map((link) => (
                    <SelectItem key={link.id} value={link.id}>
                      {link.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}

        {/* 5-Tab Layout: Severity Score, Priority Score, Score-Based AI Summary, Document-Based Summary, Combined Summary */}
        <Tabs defaultValue="severity" className="mt-6">
          <TabsList variant="line" className="mb-6 flex-wrap">
            <TabsTrigger value="severity">{t("tab1")}</TabsTrigger>
            <TabsTrigger value="priority">{t("tab2")}</TabsTrigger>
            <TabsTrigger value="summary">{t("tabs.scoreBased")}</TabsTrigger>
            <TabsTrigger value="doc-summary">{t("tabs.documentBased")}</TabsTrigger>
            <TabsTrigger value="combined-summary">{t("tabs.combined")}</TabsTrigger>
            <TabsTrigger value="decisions">{t("tabs.decisions")}</TabsTrigger>
          </TabsList>

          {/* TAB 1: Severity Score (Severity Dashboard + Response Quality) */}
          <TabsContent value="severity" className="space-y-6">
            {survey ? (
              <>
                <SeverityDashboard
                  studyId={survey.studyId}
                  surveyId={survey.id}
                  villages={need?.village || []}
                />

                {/* Response Quality Assessment Results */}
                <Card className="border-border shadow-sm">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                          <ListChecks className="text-primary size-4" />
                          {t("responseQualityTitle")}
                        </h2>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {t("responseQualityDesc")}
                        </p>
                      </div>
                      {canScore ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAssess}
                          disabled={assessing}
                        >
                          {assessing ? t("assessing") : t("runQualityAssessment")}
                        </Button>
                      ) : null}
                    </div>

                    {qualityResults && qualityResults.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("colResponseId")}</TableHead>
                            <TableHead>{t("colCompletenessScore")}</TableHead>
                            <TableHead>{t("colConfidenceFlag")}</TableHead>
                            <TableHead>{t("colDuplicateStatus")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {qualityResults.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">
                                {r.surveyResponseId}
                              </TableCell>
                              <TableCell>
                                {(r.completenessScore * 100).toFixed(0)}%
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    r.confidenceFlag === "low"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {r.confidenceFlag.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {r.isDuplicate
                                  ? t("duplicateResponse")
                                  : t("uniqueResponse")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-sm">{t("noAssessment")}</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noPublishedSurvey")}</p>
            )}
          </TabsContent>

          {/* TAB 2: Priority Score (Priority Score Matrix + Supporting Evidence) */}
          <TabsContent value="priority" className="space-y-6">
            <Card className="border-border bg-card/60 relative overflow-hidden backdrop-blur-md">
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r",
                  priorityV2
                    ? priorityV2.priorityStatus === "HIGH"
                      ? "from-destructive to-destructive/80"
                      : priorityV2.priorityStatus === "MEDIUM"
                        ? "from-warning to-warning/80"
                        : "from-success to-success/80"
                    : "from-muted to-muted",
                )}
              />
              <CardContent className="space-y-6 p-6 pt-8">
                {/* Priority Score and Status Cards */}
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Gauge className="size-4" />
                    {t("priorityMatrixTitle")}
                  </h2>
                  {canScore ? (
                    <Button size="sm" onClick={handleScore} disabled={scoring}>
                      {scoring ? t("recalculating") : t("recalculateButton")}
                    </Button>
                  ) : null}
                </div>

                {/* RIO-FR-003 AC 2 — the component breakdown, above the
                    village assessment because it is the number this need is
                    ranked and signed off on. */}
                {needScore ? (
                  <div className="mb-6">
                    <PriorityBreakdown score={needScore} onScoreUpdated={setNeedScore} />
                  </div>
                ) : null}

                {priorityV2 ? (
                  <div className="space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <span className="text-muted-foreground text-sm font-semibold">
                        {t("villagePriorityStatus")}
                      </span>
                      <Badge
                        variant={
                          priorityV2.priorityStatus === "HIGH"
                            ? "destructive"
                            : priorityV2.priorityStatus === "MEDIUM"
                              ? "secondary"
                              : "outline"
                        }
                        className="px-3 py-1 text-sm font-bold tracking-wide uppercase"
                      >
                        {priorityV2.priorityStatus} {t("prioritySuffix")}
                      </Badge>
                    </div>

                    {/* Score Metrics Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="bg-muted/40 rounded-lg p-4">
                        <p className="text-muted-foreground text-xs font-semibold uppercase">
                          {t("priorityScoreIndex")}
                        </p>
                        <p className="text-foreground mt-1 text-2xl font-bold">
                          {Math.round(priorityV2.priorityScore)}
                        </p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-4">
                        <p className="text-muted-foreground text-xs font-semibold uppercase">
                          {t("overrideStatus")}
                        </p>
                        <p className="text-foreground mt-1 text-2xl font-bold capitalize">
                          {priorityV2.overrideApplied
                            ? t("criticalOverride")
                            : t("standardRollup")}
                        </p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-4">
                        <p className="text-muted-foreground text-xs font-semibold uppercase">
                          {t("criticalOverrides")}
                        </p>
                        <p className="text-foreground mt-1 text-2xl font-bold">
                          {criticalOverrides.length}
                        </p>
                      </div>
                    </div>

                    {/* RIO-FR-005 criterion 1 — individual score components,
                        not just the aggregate priority score above. Severity
                        and Affected Group Size are real data; Urgency and
                        Theme are placeholders until RIO-FR-003's scoring
                        engine and the separate Recurring Theme Extraction
                        capability exist — see the constants above and the
                        "Placeholder" badges below. */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">
                        {t("scoreComponents.title")}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="bg-muted/40 rounded-lg p-4">
                          <p className="text-muted-foreground text-xs font-semibold uppercase">
                            {t("scoreComponents.severity")}
                          </p>
                          <p className="text-foreground mt-1 text-lg font-bold">
                            {priorityV2.priorityStatus}
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-xs font-semibold uppercase">
                              {t("scoreComponents.urgency")}
                            </p>
                            <Badge variant="outline" className="text-[10px]">
                              {t("scoreComponents.placeholderBadge")}
                            </Badge>
                          </div>
                          <p className="text-foreground mt-1 text-lg font-bold">
                            {PLACEHOLDER_URGENCY}
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-4">
                          <p className="text-muted-foreground text-xs font-semibold uppercase">
                            {t("scoreComponents.affectedGroupSize")}
                          </p>
                          <p className="text-foreground mt-1 text-lg font-bold">
                            {need?.affectedPeople == null &&
                            need?.affectedHouseholds == null
                              ? t("scoreComponents.affectedGroupSizeEmpty")
                              : [
                                  need?.affectedPeople != null
                                    ? t("scoreComponents.people", {
                                        count: need.affectedPeople,
                                      })
                                    : null,
                                  need?.affectedHouseholds != null
                                    ? t("scoreComponents.households", {
                                        count: need.affectedHouseholds,
                                      })
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                          </p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-xs font-semibold uppercase">
                              {t("scoreComponents.theme")}
                            </p>
                            <Badge variant="outline" className="text-[10px]">
                              {t("scoreComponents.placeholderBadge")}
                            </Badge>
                          </div>
                          <p className="text-foreground mt-1 text-lg font-bold">
                            {PLACEHOLDER_THEME}
                          </p>
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {t("scoreComponents.pendingNote")}
                      </p>
                    </div>

                    {/* Critical Domain Override Alert */}
                    {criticalOverrides.length > 0 && (
                      <div className="border-destructive/40 bg-destructive/10 rounded-lg border p-4 text-xs">
                        <div className="text-destructive flex items-center gap-2 font-semibold">
                          <AlertTriangle className="size-4" />
                          {t("criticalOverrideTriggered")}
                        </div>
                        <p className="text-foreground mt-1">
                          {t("criticalOverrideNote")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {criticalOverrides.map((override, i) => (
                            <Badge key={i} variant="destructive">
                              {localizedDomain(override.domainNameSnapshot)}:{" "}
                              {override.domainSeverityScore}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Domain Score / Weight / Contribution Table */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">
                        {t("domainPerformanceBreakdown")}
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("tableHeaders.domain")}</TableHead>
                            <TableHead>{t("tableHeaders.severityScore")}</TableHead>
                            <TableHead>{t("tableHeaders.performanceScore")}</TableHead>
                            <TableHead>{t("tableHeaders.weight")}</TableHead>
                            <TableHead>
                              {t("tableHeaders.weightedContribution")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(priorityV2.domainComponents || []).map((domain) => (
                            <TableRow key={domain.domainKey}>
                              <TableCell className="font-medium">
                                {localizedDomain(domain.domainNameSnapshot)}
                              </TableCell>
                              <TableCell>{domain.domainSeverityScore}</TableCell>
                              <TableCell>{domain.domainPerformanceScore}</TableCell>
                              <TableCell>
                                {(domain.domainWeight * 100).toFixed(0)}%
                              </TableCell>
                              <TableCell className="font-bold">
                                {domain.weightedContribution.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("noPriorityCalculated")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Supporting Evidence Section */}
            {survey ? (
              <SupportingEvidencePanel
                needId={needId}
                _studyId={survey.studyId}
                onEvidenceToggled={() => setSummaryKey((prev) => prev + 1)}
              />
            ) : null}
          </TabsContent>

          {/* TAB 3: Score-Based AI Summary */}
          <TabsContent value="summary">
            {survey ? (
              <AiPrioritySummaryPanel
                key={summaryKey}
                studyId={survey.studyId}
                surveyId={survey.id}
                villageId={need?.village?.[0] || ""}
                villages={need?.village || []}
                hasSeverityScoring={Boolean(priorityV2)}
                hasPriorityScoring={Boolean(priorityV2)}
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t("noSurveyAssociated")}</p>
            )}
          </TabsContent>

          {/* TAB 4: Document-Based Summary */}
          <TabsContent value="doc-summary">
            {survey ? (
              <DocumentBasedSummaryTab studyId={survey.studyId} needId={needId} />
            ) : (
              <p className="text-muted-foreground text-sm">{t("noSurveyAssociated")}</p>
            )}
          </TabsContent>

          {/* TAB 5: Combined Summary */}
          <TabsContent value="combined-summary">
            {survey ? (
              <CombinedSummaryTab studyId={survey.studyId} />
            ) : (
              <p className="text-muted-foreground text-sm">{t("noSurveyAssociated")}</p>
            )}
          </TabsContent>

          {/* TAB 6: Decisions (RIO-FR-005) */}
          <TabsContent value="decisions" className="space-y-4">
            <Card>
              <CardContent className="space-y-2 p-5">
                <h2 className="text-foreground text-sm font-semibold">
                  {t("gapTypeLabel")}
                </h2>
                <p className="text-muted-foreground text-xs">{t("gapTypeNote")}</p>
                <Select
                  value={need?.gapType ?? NONE}
                  onValueChange={handleGapTypeChange}
                  disabled={!canEditGapType || savingGapType}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-64"
                    aria-label={t("gapTypeLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("gapTypeNotSet")}</SelectItem>
                    {gapTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.name}>
                        {t.has(`gapType.${option.name}`)
                          ? t(`gapType.${option.name}` as Parameters<typeof t>[0])
                          : option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <NeedDecisionsPanel needId={needId} canManage={canScore} />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGuard>
  );
}
