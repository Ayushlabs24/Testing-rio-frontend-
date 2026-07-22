"use client";

import { Sparkles, Gauge, ListChecks, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
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
import { ApiError } from "@/services/api/types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type { PublicSurveyLink } from "@/services/public-surveys/public-surveys.types";
import { responseQualityService } from "@/services/response-quality/response-quality.service";
import type {
  AiSummary,
  ResponseQualityResult,
} from "@/services/response-quality/response-quality.types";
import { needsService } from "@/services/needs/needs.service";
import { surveysService } from "@/services/surveys/surveys.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeverityDashboard } from "@/components/features/insights/severity-dashboard";
import {
  severityScoringService,
  VillagePriorityResult,
} from "@/services/priority/severity-scoring.service";

// Sentinel for the Select's "Consolidated" option — the actual API param is
// `undefined` (omitted) for consolidated, so this never leaks past `scope`.
const CONSOLIDATED = "consolidated";

export default function NeedInsightsPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.publicSurveys.insights");
  const canWrite = usePermission("aiReview", "write");
  const canScore = usePermission("priorityScoring", "create");

  const [links, setLinks] = useState<PublicSurveyLink[]>([]);
  const [scope, setScope] = useState<string>(CONSOLIDATED);
  const surveyLinkId = scope === CONSOLIDATED ? undefined : scope;

  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [qualityResults, setQualityResults] = useState<ResponseQualityResult[] | null>(
    null,
  );
  const [priorityV2, setPriorityV2] = useState<VillagePriorityResult | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [need, setNeed] = useState<any | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [survey, setSurvey] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    publicSurveysService
      .listLinks(needId)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [needId]);

  function load() {
    needsService
      .getById(needId)
      .then(setNeed)
      .catch(() => undefined);
    surveysService
      .getSurveyByNeedId(needId)
      .then((srv) => {
        setSurvey(srv);
        if (srv) {
          severityScoringService
            .getVillagePriority(srv.studyId, srv.id, null)
            .then(setPriorityV2)
            .catch(() => setPriorityV2(null));
        }
      })
      .catch(() => undefined);
    responseQualityService
      .getSummary(needId, surveyLinkId)
      .then(setSummary)
      .catch(() => undefined);
    responseQualityService
      .list(needId, surveyLinkId)
      .then(setQualityResults)
      .catch(() => setQualityResults([]));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId, surveyLinkId]);

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    setError(null);
    try {
      const result = await responseQualityService.generateSummary(needId, surveyLinkId);
      setSummary(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleAssess() {
    setAssessing(true);
    setError(null);
    try {
      const results = await responseQualityService.assess(needId, surveyLinkId);
      setQualityResults(results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setAssessing(false);
    }
  }

  async function handleScore() {
    if (!survey) return;
    setScoring(true);
    setError(null);
    try {
      await severityScoringService.recalculate(survey.studyId, survey.id);
      const result = await severityScoringService.getVillagePriority(
        survey.studyId,
        survey.id,
        null,
      );
      setPriorityV2(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setScoring(false);
    }
  }

  return (
    <PermissionGuard module="aiReview" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/public-surveys" label={t("backToList")} />
        </div>

        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-xs font-medium">
                {t("scopeLabel")}
              </span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-full sm:w-64" aria-label={t("scopeLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CONSOLIDATED}>{t("scopeConsolidated")}</SelectItem>
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

        <Tabs defaultValue="severity" className="mt-6">
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="severity">Severity Dashboard</TabsTrigger>
            <TabsTrigger value="placeholder">Priority Score</TabsTrigger>
            <TabsTrigger value="quality">Response Quality & AI Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="severity">
            {survey ? (
              <SeverityDashboard
                studyId={survey.studyId}
                surveyId={survey.id}
                villages={need?.village || []}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                No published survey for this need yet.
              </p>
            )}
          </TabsContent>

          <TabsContent value="placeholder">
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
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Gauge className="size-4" />
                    Priority Score
                  </h2>
                  {canScore ? (
                    <Button size="sm" onClick={handleScore} disabled={scoring}>
                      {scoring ? "Recalculating..." : "Recalculate Priority"}
                    </Button>
                  ) : null}
                </div>

                {priorityV2 ? (
                  <div className="space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between border-b pb-4">
                      <span className="text-muted-foreground text-sm font-semibold">
                        Priority Category
                      </span>
                      <Badge
                        className={cn(
                          "border-transparent px-3 py-1 text-sm font-bold",
                          priorityV2.priorityStatus === "HIGH"
                            ? "bg-destructive text-destructive-foreground"
                            : priorityV2.priorityStatus === "MEDIUM"
                              ? "bg-warning text-warning-foreground"
                              : "bg-success text-success-foreground",
                        )}
                      >
                        {priorityV2.priorityStatus === "HIGH"
                          ? "High Priority"
                          : priorityV2.priorityStatus === "MEDIUM"
                            ? "Medium Priority"
                            : "Low Priority"}
                      </Badge>
                    </div>

                    {/* Override Alert */}
                    {priorityV2.overrideApplied && (
                      <div className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-lg border p-3">
                        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                        <div className="text-sm">
                          <p className="text-destructive font-bold">
                            High Priority — Critical Domain Override
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {priorityV2.overrideReason}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Score Display */}
                    <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                          Governorate Priority Score
                        </span>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Lower performance = higher intervention priority
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-3xl font-black tabular-nums",
                          priorityV2.priorityStatus === "HIGH"
                            ? "text-destructive"
                            : priorityV2.priorityStatus === "MEDIUM"
                              ? "text-warning"
                              : "text-success",
                        )}
                      >
                        {priorityV2.priorityScore.toFixed(1)}
                        <span className="text-muted-foreground ml-1 text-sm font-normal">
                          / 100
                        </span>
                      </span>
                    </div>

                    {/* Domain Table */}
                    {priorityV2.domainComponents.length > 0 && (
                      <div>
                        <h3 className="text-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                          Domain Performance & Priority Breakdown
                        </h3>
                        <div className="overflow-x-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/40">
                                <TableHead className="py-2 text-xs">Domain</TableHead>
                                <TableHead className="py-2 text-right text-xs">
                                  Severity
                                </TableHead>
                                <TableHead className="py-2 text-right text-xs">
                                  Performance
                                </TableHead>
                                <TableHead className="py-2 text-right text-xs">
                                  Weight
                                </TableHead>
                                <TableHead className="py-2 text-right text-xs">
                                  Contribution
                                </TableHead>
                                <TableHead className="py-2 text-center text-xs">
                                  Critical?
                                </TableHead>
                                <TableHead className="py-2 text-center text-xs">
                                  Override?
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {priorityV2.domainComponents.map((comp) => (
                                <TableRow
                                  key={comp.domainKey}
                                  className={cn(
                                    "hover:bg-muted/20 text-xs",
                                    comp.triggeredOverride && "bg-destructive/5",
                                  )}
                                >
                                  <TableCell className="py-2 font-semibold">
                                    {comp.domainNameSnapshot}
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
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground mb-4 text-sm">
                      No priority score calculated for this scope yet.
                    </p>
                    {canScore && (
                      <Button size="sm" onClick={handleScore} disabled={scoring}>
                        {scoring ? "Calculating..." : "Run Priority Scoring"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="space-y-6">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4" />
                    {t("aiSummaryHeading")}
                  </h2>
                  {canWrite ? (
                    <Button
                      size="sm"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? t("generating") : t("generateSummary")}
                    </Button>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {t("aiSummaryPlaceholderNote")}
                </p>
                {summary ? (
                  <div className="bg-muted/40 rounded-md border px-3.5 py-3 text-sm">
                    <p>{summary.summaryText}</p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {t("responseCount", { count: summary.responseCount })}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{t("noSummary")}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                    <ListChecks className="size-4" />
                    {t("responseQualityHeading")}
                  </h2>
                  {canWrite ? (
                    <Button size="sm" onClick={handleAssess} disabled={assessing}>
                      {assessing ? t("assessing") : t("assessQuality")}
                    </Button>
                  ) : null}
                </div>
                {qualityResults === null ? (
                  <div className="bg-muted h-16 animate-pulse rounded-md" />
                ) : qualityResults.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("noQualityResults")}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("completenessColumn")}</TableHead>
                        <TableHead>{t("confidenceColumn")}</TableHead>
                        <TableHead>{t("duplicateColumn")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qualityResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell className="text-sm">
                            {result.completenessScore}%
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                result.confidenceFlag === "low" ? "outline" : "secondary"
                              }
                            >
                              {result.confidenceFlag}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {result.isDuplicate ? t("yes") : t("no")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PermissionGuard>
  );
}
