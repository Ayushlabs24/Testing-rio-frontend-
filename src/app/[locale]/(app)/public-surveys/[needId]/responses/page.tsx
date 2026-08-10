"use client";

import { MessageSquareText } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionResponseCard } from "@/components/features/surveys/question-response-card";
import { SurveyResponseSummaryCard } from "@/components/features/surveys/survey-response-summary-card";
import { computeQuestionStats, type StatsQuestion } from "@/lib/survey-response-stats";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type { SurveyResponseDetail } from "@/services/public-surveys/public-surveys.types";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

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
  const [responses, setResponses] = useState<SurveyResponseDetail[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    needsService
      .getById(needId)
      .then(async (needResult) => {
        if (cancelled) return;
        setNeed(needResult);
        const [study, surveyResult, responseRows] = await Promise.all([
          studiesService.getById(needResult.studyId).catch(() => null),
          surveysService.getSurveyByNeedId(needId).catch(() => null),
          publicSurveysService.listResponsesWithAnswers(needId).catch(() => []),
        ]);
        if (cancelled) return;
        setStudyTitle(study?.title ?? "");
        setSurvey(surveyResult);
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
  // resolves and labels the answer correctly. Build the full question
  // universe from both sources so a historical answer gets its own stats
  // card instead of silently vanishing the moment a newer version publishes.
  const questionUniverse = useMemo(() => {
    const byId = new Map<string, StatsQuestion>();
    for (const q of survey?.questions ?? []) {
      byId.set(q.id, q);
    }
    for (const response of responses ?? []) {
      for (const a of response.answers) {
        if (!byId.has(a.questionId)) {
          byId.set(a.questionId, {
            id: a.questionId,
            questionText: a.questionText,
            answerType: a.answerType,
            answerOptions: a.answerOptions,
          });
        }
      }
    }
    return Array.from(byId.values());
  }, [survey, responses]);

  const stats = useMemo(
    () => computeQuestionStats(questionUniverse, responses ?? []),
    [questionUniverse, responses],
  );

  const loaded = responses !== null;
  const hasResponses = (responses ?? []).length > 0;

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href={`/public-surveys/${needId}`} label={t("backToSurvey")} />
        </div>

        <PageHeader title={need?.title ?? ""} description={t("description")} />

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
