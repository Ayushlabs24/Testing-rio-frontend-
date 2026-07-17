"use client";

import { ArrowLeft, Sparkles, Gauge, ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
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
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { priorityService } from "@/services/priority/priority.service";
import type { PriorityScore } from "@/services/priority/priority.types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type { PublicSurveyLink } from "@/services/public-surveys/public-surveys.types";
import { responseQualityService } from "@/services/response-quality/response-quality.service";
import type {
  AiSummary,
  ResponseQualityResult,
} from "@/services/response-quality/response-quality.types";

const LEVEL_VARIANT: Record<
  PriorityScore["level"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

// Sentinel for the Select's "Consolidated" option — the actual API param is
// `undefined` (omitted) for consolidated, so this never leaks past `scope`.
const CONSOLIDATED = "consolidated";

export default function StudyInsightsPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = use(params);
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
  const [priorityScore, setPriorityScore] = useState<PriorityScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    publicSurveysService
      .listLinks(studyId)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [studyId]);

  function load() {
    responseQualityService
      .getSummary(studyId, surveyLinkId)
      .then(setSummary)
      .catch(() => undefined);
    responseQualityService
      .list(studyId, surveyLinkId)
      .then(setQualityResults)
      .catch(() => setQualityResults([]));
    priorityService
      .getLatest(studyId, surveyLinkId)
      .then(setPriorityScore)
      .catch(() => undefined);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, surveyLinkId]);

  async function handleGenerateSummary() {
    setGeneratingSummary(true);
    setError(null);
    try {
      const result = await responseQualityService.generateSummary(studyId, surveyLinkId);
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
      const results = await responseQualityService.assess(studyId, surveyLinkId);
      setQualityResults(results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setAssessing(false);
    }
  }

  async function handleScore() {
    setScoring(true);
    setError(null);
    try {
      const result = await priorityService.score(studyId, surveyLinkId);
      setPriorityScore(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setScoring(false);
    }
  }

  return (
    <PermissionGuard module="aiReview" action="read">
      <PageContainer>
        <Link
          href="/public-surveys"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToList")}
        </Link>

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

        <div className="space-y-6">
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

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <Gauge className="size-4" />
                  {t("priorityHeading")}
                </h2>
                {canScore ? (
                  <Button size="sm" onClick={handleScore} disabled={scoring}>
                    {scoring ? t("scoring") : t("runScoring")}
                  </Button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("priorityPlaceholderNote")}
              </p>
              {priorityScore ? (
                <div className="space-y-4">
                  <div className="bg-muted/40 grid gap-4 rounded-md border px-3.5 py-3 sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground text-xs">
                        {t("overallScoreLabel")}
                      </p>
                      <p className="text-foreground text-lg font-semibold tabular-nums">
                        {priorityScore.overallScore}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("levelLabel")}</p>
                      <Badge variant={LEVEL_VARIANT[priorityScore.level]}>
                        {priorityScore.level}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t("gapTypeLabel")}</p>
                      <p className="text-foreground text-sm">{priorityScore.gapType}</p>
                    </div>
                  </div>
                  {priorityScore.cycleNote ? (
                    <p className="text-muted-foreground text-xs">
                      {t("cycleNoteLabel")}: {priorityScore.cycleNote}
                    </p>
                  ) : null}
                  <div>
                    <p className="text-foreground mb-2 text-xs font-medium">
                      {t("factorsHeading")}
                    </p>
                    <div className="divide-border divide-y rounded-md border">
                      {priorityScore.factors.map((factor) => (
                        <div
                          key={factor.key}
                          className="flex items-center justify-between px-3.5 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{factor.label}</span>
                          <span className="tabular-nums">{factor.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noScore")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}
