"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MapPin,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { AutoTranslate } from "@/components/common/auto-translate";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  severityScoringService,
  SeverityDashboardResult,
  SeverityKpiRankingEntry,
  QuestionDetailResult,
  VillagePriorityResult,
  DomainPriorityComponent,
} from "@/services/priority/severity-scoring.service";
import { ApiError } from "@/services/api/types";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";

interface SeverityDashboardProps {
  studyId: string;
  surveyId: string;
  villages: string[];
}

export function SeverityDashboard({
  studyId,
  surveyId,
  villages,
}: SeverityDashboardProps) {
  const t = useTranslations("PriorityDashboard.severityDashboard");
  const { localizedDomain } = useDomainArabicMap();
  const canRecalculate = usePermission("priorityScoring", "create");

  const [selectedVillage, setSelectedVillage] = useState<string>("consolidated");
  const [dashboardData, setDashboardData] = useState<SeverityDashboardResult | null>(
    null,
  );
  const [kpisRanked, setKpisRanked] = useState<SeverityKpiRankingEntry[]>([]);
  const [priorityData, setPriorityData] = useState<VillagePriorityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drilldown selection
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  // Question detail modal state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questionDetail, setQuestionDetail] = useState<QuestionDetailResult | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  const activeVillageId = selectedVillage === "consolidated" ? null : selectedVillage;

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, surveyId, selectedVillage]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const db = await severityScoringService.getDashboard(
        studyId,
        surveyId,
        activeVillageId,
      );
      setDashboardData(db);
      const ranks = await severityScoringService.getKpiRankings(
        studyId,
        surveyId,
        activeVillageId,
      );
      setKpisRanked(ranks);
      try {
        const prio = await severityScoringService.getVillagePriority(
          studyId,
          surveyId,
          activeVillageId,
        );
        setPriorityData(prio);
      } catch {
        // Priority data may not exist yet — not an error
        setPriorityData(null);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load severity dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    setError(null);
    try {
      await severityScoringService.recalculate(studyId, surveyId);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Recalculating failed.");
    } finally {
      setRecalculating(false);
    }
  }

  async function handleOpenQuestionDetail(questionId: string) {
    setSelectedQuestionId(questionId);
    setLoadingQuestion(true);
    try {
      const detail = await severityScoringService.getQuestionDetail(
        studyId,
        surveyId,
        questionId,
        activeVillageId,
      );
      setQuestionDetail(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestion(false);
    }
  }

  // Get score styling helper (0 to 100)
  function getScoreColorClass(score: number | null): {
    text: string;
    bg: string;
    border: string;
    bgGradient: string;
  } {
    if (score === null)
      return {
        text: "text-muted-foreground",
        bg: "bg-muted",
        border: "border-muted",
        bgGradient: "from-muted/40 to-muted/10",
      };
    if (score >= 70)
      return {
        text: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/20",
        bgGradient: "from-destructive/20 to-destructive/5",
      };
    if (score >= 40)
      return {
        text: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
        bgGradient: "from-warning/20 to-warning/5",
      };
    return {
      text: "text-success",
      bg: "bg-success/10",
      border: "border-success/20",
      bgGradient: "from-success/20 to-success/5",
    };
  }

  const overall = dashboardData?.overall;
  const overallColors = getScoreColorClass(overall?.severityScore ?? null);

  return (
    <div className="space-y-8">
      {/* Filters & Actions */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-3">
          <MapPin className="text-muted-foreground size-5" />
          <Label htmlFor="village-filter" className="text-sm font-semibold">
            {t("filterLabel")}
          </Label>
          <select
            id="village-filter"
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="border-input bg-background focus-visible:ring-ring h-9 w-60 rounded-md border px-3 py-1 text-sm font-medium shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            <option value="consolidated">{t("consolidatedOption")}</option>
            {villages.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {canRecalculate && (
          <Button
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/10 gap-2 shadow-lg"
          >
            <RefreshCw className={cn("size-4", recalculating && "animate-spin")} />
            {recalculating ? t("recalculating") : t("recalculateButton")}
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive flex items-center space-x-2 rounded-md p-4">
          <AlertTriangle className="size-5" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="text-primary mb-2 size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left / Top Column: Overall Index & Explanations */}
          <div className="space-y-6 lg:col-span-1">
            <Card className="border-border bg-card/60 relative overflow-hidden backdrop-blur-md">
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r",
                  overall &&
                    overall.severityScore !== null &&
                    overall.severityScore !== undefined
                    ? overall.severityScore >= 70
                      ? "from-destructive to-destructive/80"
                      : overall.severityScore >= 40
                        ? "from-warning to-warning/80"
                        : "from-success to-success/80"
                    : "from-muted to-muted",
                )}
              />
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">{t("indexTitle")}</CardTitle>
                <CardDescription>{t("indexDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-6 text-center">
                <div
                  className={cn(
                    "relative flex size-36 items-center justify-center rounded-full border-4",
                    overallColors.border,
                  )}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "text-4xl font-extrabold tracking-tight tabular-nums",
                        overallColors.text,
                      )}
                    >
                      {overall &&
                      overall.severityScore !== null &&
                      overall.severityScore !== undefined
                        ? Math.round(overall.severityScore)
                        : "—"}
                    </span>
                    <span className="text-muted-foreground mt-1 text-[10px] font-bold tracking-widest uppercase">
                      {t("severity")}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex w-full flex-col space-y-3">
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="text-muted-foreground font-medium">
                      {t("confidenceLevel")}
                    </span>
                    <Badge
                      variant={
                        overall?.confidenceLevel === "LOW" ? "destructive" : "secondary"
                      }
                      className="font-semibold"
                    >
                      {overall?.confidenceLevel ?? "STANDARD"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="text-muted-foreground font-medium">
                      {t("validResponses")}
                    </span>
                    <span className="text-foreground font-bold">
                      {overall?.validResponseCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-1 text-sm">
                    <span className="text-muted-foreground font-medium">
                      {t("dontKnowRate")}
                    </span>
                    <span className="text-foreground font-bold">
                      {overall?.dontKnowRate
                        ? `${Math.round(overall.dontKnowRate * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                </div>

                <div className="text-muted-foreground mt-6 w-full border-t pt-4 text-left text-xs leading-relaxed">
                  <p className="text-foreground mb-1 font-semibold">
                    {t("indexDefinition")}
                  </p>
                  {t("indexDefinitionDesc")}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Domain Grid and KPI Ranking */}
          <div className="space-y-6 lg:col-span-2">
            {/* Domain Cards */}
            <div>
              <h3 className="text-foreground mb-4 text-base font-bold">
                {t("domainsTitle")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {dashboardData?.domains.map((dom) => {
                  const colors = getScoreColorClass(dom.severityScore);
                  const isSelected = selectedDomain === dom.id;
                  return (
                    <Card
                      key={dom.id}
                      onClick={() => setSelectedDomain(isSelected ? null : dom.id)}
                      className={cn(
                        "border-border hover:border-primary/50 bg-card/40 hover:bg-card/70 relative cursor-pointer overflow-hidden transition-all duration-300",
                        isSelected && "ring-primary border-transparent ring-2",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r",
                          dom.severityScore !== null
                            ? dom.severityScore >= 70
                              ? "from-destructive to-destructive/80"
                              : dom.severityScore >= 40
                                ? "from-warning to-warning/80"
                                : "from-success to-success/80"
                            : "from-muted to-muted",
                        )}
                      />
                      <CardContent className="flex h-28 flex-col justify-between p-4">
                        <div className="flex items-start justify-between">
                          <span className="text-foreground max-w-[120px] truncate text-sm font-bold tracking-tight">
                            {dom.name}
                          </span>
                          <Badge
                            variant={
                              dom.confidenceLevel === "LOW" ? "destructive" : "secondary"
                            }
                            className="px-1 py-0 text-[9px] font-medium"
                          >
                            {dom.confidenceLevel}
                          </Badge>
                        </div>
                        <div className="mt-auto flex items-baseline justify-between">
                          <span
                            className={cn(
                              "text-2xl font-black tabular-nums",
                              colors.text,
                            )}
                          >
                            {dom.severityScore !== null
                              ? Math.round(dom.severityScore)
                              : "—"}
                          </span>
                          <ChevronRight
                            className={cn(
                              "text-muted-foreground size-4 transition-transform rtl:-scale-x-100",
                              isSelected && "text-primary rotate-90",
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Drilldown details when Domain is selected */}
            {selectedDomain && (
              <Card className="border-primary/20 bg-primary/5 backdrop-blur-md">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="flex items-center justify-between text-sm font-bold">
                    <span>{t("subDomainsTitle", { domain: selectedDomain })}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary h-7 text-xs"
                      onClick={() => setSelectedDomain(null)}
                    >
                      {t("close")}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  {dashboardData?.subDomains
                    .filter((sd) => {
                      // Filter subdomains matching selectedDomain
                      const kpiMatch = dashboardData.kpis.find(
                        (k) =>
                          k.id &&
                          kpisRanked.find(
                            (kr) =>
                              kr.kpi === k.id &&
                              kr.domain === selectedDomain &&
                              kr.subDomain === sd.id,
                          ),
                      );
                      return !!kpiMatch;
                    })
                    .map((sd) => (
                      <div key={sd.id} className="border-b pb-3 last:border-0 last:pb-0">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-foreground text-sm font-bold">
                            {sd.name}
                          </span>
                          <span className="text-primary text-sm font-semibold tabular-nums">
                            {sd.severityScore !== null
                              ? Math.round(sd.severityScore)
                              : "—"}
                          </span>
                        </div>
                        {/* Indicators under this subdomain */}
                        <div className="border-primary/20 space-y-1.5 border-l-2 pl-4">
                          {dashboardData.indicators
                            .filter((ind) => {
                              const match = kpisRanked.find(
                                (kr) => kr.indicator === ind.id && kr.subDomain === sd.id,
                              );
                              return !!match;
                            })
                            .map((ind) => (
                              <div
                                key={ind.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="text-muted-foreground font-medium">
                                  {ind.name}
                                </span>
                                <span className="text-foreground font-bold tabular-nums">
                                  {ind.severityScore !== null
                                    ? Math.round(ind.severityScore)
                                    : "—"}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Governorate Priority Status Card */}
            {priorityData && (
              <Card className="border-border bg-card/60 relative overflow-hidden backdrop-blur-md">
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r",
                    priorityData.priorityStatus === "HIGH"
                      ? "from-destructive to-destructive/80"
                      : priorityData.priorityStatus === "MEDIUM"
                        ? "from-warning to-warning/80"
                        : "from-success to-success/80",
                  )}
                />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">
                      {t("priorityStatusTitle")}
                    </CardTitle>
                    <Badge
                      className={cn(
                        "px-3 py-1 text-sm font-bold",
                        priorityData.priorityStatus === "HIGH"
                          ? "bg-destructive text-destructive-foreground"
                          : priorityData.priorityStatus === "MEDIUM"
                            ? "bg-warning text-warning-foreground"
                            : "bg-success text-success-foreground",
                      )}
                    >
                      {priorityData.priorityStatus === "HIGH"
                        ? t("highPriority")
                        : priorityData.priorityStatus === "MEDIUM"
                          ? t("mediumPriority")
                          : t("lowPriority")}
                    </Badge>
                  </div>
                  <CardDescription>{t("priorityStatusDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Override alert */}
                  {priorityData.overrideApplied && (
                    <div className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-lg border p-3">
                      <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                      <div className="text-sm">
                        <p className="text-destructive font-bold">
                          {t("criticalOverrideTitle")}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          <AutoTranslate text={priorityData.overrideReason} />
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Score display */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      {t("priorityScoreLabel")}
                    </span>
                    <span
                      className={cn(
                        "text-2xl font-black tabular-nums",
                        priorityData.priorityStatus === "HIGH"
                          ? "text-destructive"
                          : priorityData.priorityStatus === "MEDIUM"
                            ? "text-warning"
                            : "text-success",
                      )}
                    >
                      {priorityData.priorityScore.toFixed(1)}
                      <span className="text-muted-foreground ml-1 text-sm font-normal">
                        / 100
                      </span>
                    </span>
                  </div>

                  {/* Metadata */}
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      {t("methodology")} {priorityData.methodologyVersion}
                    </span>
                    <span>
                      {t("calculated")}{" "}
                      {new Date(priorityData.calculatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Domain Contribution Table */}
                  {priorityData.domainComponents.length > 0 && (
                    <div>
                      <h4 className="text-foreground mt-2 mb-2 text-xs font-bold tracking-wider uppercase">
                        {t("domainContributionsTitle")}
                      </h4>
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              <TableHead className="py-2 text-xs">
                                {t("tableHeaders.domain")}
                              </TableHead>
                              <TableHead className="py-2 text-right text-xs">
                                {t("tableHeaders.severity")}
                              </TableHead>
                              <TableHead className="py-2 text-right text-xs">
                                {t("tableHeaders.performance")}
                              </TableHead>
                              <TableHead className="py-2 text-right text-xs">
                                {t("tableHeaders.weight")}
                              </TableHead>
                              <TableHead className="py-2 text-right text-xs">
                                {t("tableHeaders.contribution")}
                              </TableHead>
                              <TableHead className="py-2 text-center text-xs">
                                {t("tableHeaders.critical")}
                              </TableHead>
                              <TableHead className="py-2 text-center text-xs">
                                {t("tableHeaders.override")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(
                              priorityData.domainComponents as DomainPriorityComponent[]
                            ).map((comp) => (
                              <TableRow
                                key={comp.domainKey}
                                className={cn(
                                  "hover:bg-muted/20 text-xs",
                                  comp.triggeredOverride && "bg-destructive/5",
                                )}
                              >
                                <TableCell className="py-2 font-semibold">
                                  {localizedDomain(comp.domainNameSnapshot)}
                                </TableCell>
                                <TableCell className="text-muted-foreground py-2 text-right tabular-nums">
                                  {comp.domainSeverityScore.toFixed(1)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "py-2 text-right font-bold tabular-nums",
                                    comp.domainPerformanceScore <
                                      comp.criticalThreshold && comp.isCriticalDomain
                                      ? "text-destructive"
                                      : "text-foreground",
                                  )}
                                >
                                  {comp.domainPerformanceScore.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-muted-foreground py-2 text-right tabular-nums">
                                  {(comp.domainWeight * 100).toFixed(0)}%
                                </TableCell>
                                <TableCell className="text-primary py-2 text-right font-semibold tabular-nums">
                                  {comp.weightedContribution.toFixed(2)}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  {comp.isCriticalDomain ? (
                                    <Badge
                                      variant="outline"
                                      className="border-destructive/60 text-destructive px-1 py-0 text-[9px]"
                                    >
                                      Yes
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                  {comp.triggeredOverride ? (
                                    <Badge
                                      variant="destructive"
                                      className="px-1 py-0 text-[9px]"
                                    >
                                      ⚠ Yes
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* KPI Severity Rankings Table */}
            <Card className="border-border bg-card/60 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">
                  {t("kpiRankingsTitle")}
                </CardTitle>
                <CardDescription>{t("kpiRankingsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          {t("tableHeaders.rank")}
                        </TableHead>
                        <TableHead>{t("tableHeaders.kpi")}</TableHead>
                        <TableHead>{t("tableHeaders.domain")}</TableHead>
                        <TableHead className="text-right">
                          {t("tableHeaders.score")}
                        </TableHead>
                        <TableHead className="text-center">
                          {t("tableHeaders.confidence")}
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kpisRanked.map((item) => {
                        const scoreColors = getScoreColorClass(item.severityScore);
                        return (
                          <TableRow key={item.kpi} className="hover:bg-muted/30">
                            <TableCell className="text-muted-foreground text-center font-bold">
                              {item.rank}
                            </TableCell>
                            <TableCell className="text-foreground text-sm font-semibold">
                              <AutoTranslate text={item.kpi} />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {localizedDomain(item.domain)}
                            </TableCell>
                            <TableCell className="text-right font-black tabular-nums">
                              <span className={scoreColors.text}>
                                {item.severityScore !== null
                                  ? Math.round(item.severityScore)
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  item.confidenceLevel === "LOW"
                                    ? "destructive"
                                    : "outline"
                                }
                                className="text-[10px] font-medium"
                              >
                                {item.confidenceLevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {/* Resolve questions mapping to this KPI and open first matching question */}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="hover:bg-muted size-7"
                                aria-label={t("viewKpiDetail")}
                                onClick={() => {
                                  // Use the kpi field as entity name; open by fetching all questions
                                  // The ranking item.kpi is the entityId stored in ScoreRollup,
                                  // which equals the Question.kpi column value.
                                  // We look up the first questionId for this KPI from the dashboard data.
                                  const matchingKpi = (dashboardData?.kpis ?? []).find(
                                    (k) => k.id === item.kpi || k.name === item.kpi,
                                  );
                                  if (matchingKpi) {
                                    // The KPI entityId is the kpi name; we need to resolve to a questionId.
                                    // The ranking entry already has the domain/indicator context,
                                    // so we open a generic detail using the kpi name as-is.
                                    handleOpenQuestionDetail(item.kpi);
                                  } else {
                                    handleOpenQuestionDetail(item.kpi);
                                  }
                                }}
                              >
                                <ArrowRight className="text-muted-foreground size-3.5 rtl:rotate-180" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Question Detail Modal */}
      <Dialog
        open={selectedQuestionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedQuestionId(null);
            setQuestionDetail(null);
          }
        }}
      >
        <DialogContent className="border-border bg-card sm:max-w-xl">
          {loadingQuestion ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="text-primary size-8 animate-spin" />
              <p className="text-muted-foreground mt-2 text-xs">
                {t("questionDetail.loading")}
              </p>
            </div>
          ) : questionDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-base font-bold">
                  <Badge variant="outline" className="font-bold">
                    {questionDetail.questionId}
                  </Badge>
                  <span className="text-muted-foreground text-xs font-normal">
                    {t("questionDetail.methodology")} {questionDetail.methodologyVersion}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-foreground pt-2 text-sm font-medium">
                  {questionDetail.questionText}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[60vh] min-h-0 space-y-6 overflow-y-auto pr-1">
                {/* Score Summary Banner */}
                <div className="bg-muted/40 grid grid-cols-2 gap-4 rounded-lg border px-4 py-3 text-center sm:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {t("questionDetail.severity")}
                    </span>
                    <p className="text-foreground mt-0.5 text-lg font-black tabular-nums">
                      {questionDetail.averageSeverity !== null
                        ? Math.round(questionDetail.averageSeverity)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {t("questionDetail.valid")}
                    </span>
                    <p className="text-foreground mt-0.5 text-lg font-bold tabular-nums">
                      {questionDetail.validCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {t("questionDetail.dontKnow")}
                    </span>
                    <p className="text-foreground mt-0.5 text-lg font-bold tabular-nums">
                      {questionDetail.dontKnowCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {t("questionDetail.na")}
                    </span>
                    <p className="text-foreground mt-0.5 text-lg font-bold tabular-nums">
                      {questionDetail.notApplicableCount}
                    </p>
                  </div>
                </div>

                {/* Answers distribution progress bars */}
                <div>
                  <h4 className="text-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                    {t("questionDetail.distributionTitle")}
                  </h4>
                  <div className="space-y-3">
                    {questionDetail.optionsDistribution.map((opt) => {
                      const total =
                        questionDetail.validCount +
                        questionDetail.excludedCount +
                        questionDetail.dontKnowCount;
                      const percentage = total > 0 ? (opt.count / total) * 100 : 0;
                      return (
                        <div key={opt.optionId} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-foreground max-w-[320px] truncate">
                              {opt.label}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {opt.count} ({Math.round(percentage)}%)
                            </span>
                          </div>
                          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lookup Weights config */}
                <div>
                  <h4 className="text-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                    {t("questionDetail.scoringLookupTitle")}
                  </h4>
                  <div className="divide-y overflow-hidden rounded-md border text-xs">
                    <div className="bg-muted/60 text-muted-foreground grid grid-cols-3 gap-2 p-2 font-semibold">
                      <span>{t("questionDetail.tableHeaders.option")}</span>
                      <span className="text-center">
                        {t("questionDetail.tableHeaders.severityScore")}
                      </span>
                      <span className="text-right">
                        {t("questionDetail.tableHeaders.exclusionStatus")}
                      </span>
                    </div>
                    {questionDetail.lookups.map((l, i) => (
                      <div
                        key={i}
                        className="hover:bg-muted/10 grid grid-cols-3 gap-2 p-2"
                      >
                        <span className="text-foreground truncate font-medium">
                          {l.optionId || t("questionDetail.numericRange")}
                        </span>
                        <span className="text-primary text-center font-bold tabular-nums">
                          {l.severityScore !== null ? l.severityScore : "—"}
                        </span>
                        <span className="text-right">
                          {l.isExcluded ? (
                            <Badge variant="destructive" className="px-1 py-0 text-[9px]">
                              {l.exclusionReason || t("questionDetail.excluded")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              {t("questionDetail.none")}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
