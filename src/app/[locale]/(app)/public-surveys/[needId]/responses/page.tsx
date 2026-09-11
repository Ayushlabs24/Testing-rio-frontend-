"use client";

import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionResponseCard } from "@/components/features/surveys/question-response-card";
import { SurveyResponseSummaryCard } from "@/components/features/surveys/survey-response-summary-card";
import { computeQuestionStats, type StatsQuestion } from "@/lib/survey-response-stats";
import { useAutoTranslate } from "@/hooks/use-auto-translate";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type { SurveyResponseDetail } from "@/services/public-surveys/public-surveys.types";
import { studiesService } from "@/services/studies/studies.service";
import {
  surveysService,
  type Survey,
  type SurveyVersionSummary,
} from "@/services/surveys/surveys.service";

export default function SurveyResponseSummaryPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.publicSurveys.responseSummary");

  const [need, setNeed] = useState<Need | null>(null);
  const [studyTitle, setStudyTitle] = useState("");
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [versions, setVersions] = useState<SurveyVersionSummary[]>([]);
  const [responses, setResponses] = useState<SurveyResponseDetail[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    needsService
      .getById(needId)
      .then(async (needResult) => {
        if (cancelled) return;
        setNeed(needResult);
        const [study, surveyResult, versionRows, responseRows] = await Promise.all([
          studiesService.getById(needResult.studyId).catch(() => null),
          // RIO-FR-011: the currently PUBLISHED version, not "latest" — a
          // draft v2 sitting unpublished must not make this page (or its
          // status badge) flip away from the still-live v1.
          surveysService.getPublishedSurveyByNeedId(needId).catch(() => null),
          surveysService.listSurveyVersionsByNeedId(needId).catch(() => []),
          publicSurveysService.listResponsesWithAnswers(needId).catch(() => []),
        ]);
        if (cancelled) return;
        setStudyTitle(study?.title ?? "");
        setSurvey(surveyResult);
        setVersions(versionRows);
        setResponses(responseRows);
      })
      .catch(() => {
        if (!cancelled) {
          setResponses([]);
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needId]);

  // RIO-FR-011: a response may answer a question from a superseded survey
  // version — that question id no longer appears in `survey.questions`
  // (the current version's own list), even though the backend still
  // resolves and labels the answer correctly. `createNewVersion` copies
  // questions into fresh ids, so the same question text can appear under
  // several ids across versions. Dedupe by text (the actual semantic
  // identity) rather than id, merging every other id sharing that text into
  // `aliasIds` so one card shows combined stats instead of one card per
  // version-specific id.
  const questionUniverse = useMemo(() => {
    const byText = new Map<string, StatsQuestion>();
    const addOrMerge = (candidate: StatsQuestion) => {
      const existing = byText.get(candidate.questionText);
      if (!existing) {
        byText.set(candidate.questionText, candidate);
        return;
      }
      if (existing.id === candidate.id) return;
      const aliasIds = existing.aliasIds ?? [];
      if (!aliasIds.includes(candidate.id)) {
        byText.set(candidate.questionText, {
          ...existing,
          aliasIds: [...aliasIds, candidate.id],
        });
      }
    };
    for (const q of survey?.questions ?? []) {
      addOrMerge(q);
    }
    for (const response of responses ?? []) {
      for (const a of response.answers) {
        addOrMerge({
          id: a.questionId,
          questionText: a.questionText,
          answerType: a.answerType,
          answerOptions: a.answerOptions,
        });
      }
    }
    return Array.from(byText.values());
  }, [survey, responses]);

  const stats = useMemo(
    () => computeQuestionStats(questionUniverse, responses ?? []),
    [questionUniverse, responses],
  );

  const loaded = responses !== null;
  const hasResponses = (responses ?? []).length > 0;
  // PageHeader's `title` is a plain string, not JSX.
  const needTitle = useAutoTranslate(need?.title).text;

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href={`/public-surveys/${needId}`} label={t("backToSurvey")} />
        </div>

        <PageHeader title={need?.title ? needTitle : ""} description={t("description")} />

        {!loaded ? (
          <div className="mt-6 space-y-6">
            <div className="bg-muted h-28 w-full animate-pulse rounded-md" />
            <div className="bg-muted h-40 w-full animate-pulse rounded-md" />
            <div className="bg-muted h-40 w-full animate-pulse rounded-md" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <SurveyResponseSummaryCard
              needId={needId}
              surveyTitle={survey?.title ?? need?.title ?? ""}
              studyTitle={studyTitle}
              status={survey?.status ?? "DRAFT"}
              totalResponses={responses?.length ?? 0}
              lastResponseAt={responses?.[0]?.submittedAt ?? null}
            />

            {versions.length > 1 ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h2 className="text-foreground text-sm font-semibold">
                      {t("versionsHeading")}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("versionsHint")}
                    </p>
                  </div>
                  <div className="divide-border divide-y">
                    {versions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-foreground text-sm font-medium">
                            {t("versionLabel", { version: v.version })}
                          </span>
                          <Badge variant="secondary" className="border-transparent">
                            {t(`versionStatus.${v.status}`)}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground text-sm tabular-nums">
                          {t("versionResponsesLabel", { count: v.responseCount })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {!hasResponses ? (
              <Card>
                <CardContent className="flex h-56 flex-col items-center justify-center gap-3 text-center">
                  <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                    <MessageSquareText className="text-muted-foreground size-6" />
                  </div>
                  <p className="text-foreground text-sm font-medium">
                    {loadFailed ? t("loadError") : t("emptyStateTitle")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3">
                  <h2 className="text-foreground text-sm font-semibold">
                    {t("questionsHeading")}
                  </h2>
                  <div className="space-y-3">
                    {stats.map((stat) => (
                      <QuestionResponseCard
                        key={stat.questionId}
                        needId={needId}
                        stat={stat}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </PageContainer>
    </PermissionGuard>
  );
}
