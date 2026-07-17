"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  PieChart as ChartIcon,
  Users,
  CheckCircle2,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

interface ResponseSlice {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

interface QuestionStats {
  questionId: string;
  questionText: string;
  answerType: string;
  slices: ResponseSlice[];
  textResponses?: string[];
}

export default function SurveyResponsesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [study, setStudy] = useState<Study | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuestionStats[]>([]);
  const [totalRespondents, setTotalRespondents] = useState(48);
  const [isDemoData, setIsDemoData] = useState(false);

  const colors = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];

  const generateStats = (questions: Survey["questions"]) => {
    const total = 48; // Standard sample size
    setTotalRespondents(total);

    const computedStats: QuestionStats[] = questions.map((q) => {
      // 1. If multiple choice / boolean / select
      if (q.answerType === "select" || q.answerType === "boolean") {
        const options = q.answerOptions || ["Yes", "No", "Don't know"];

        // Distribute 48 respondents across options
        let remaining = total;
        const counts = options.map((opt, idx) => {
          if (idx === options.length - 1) {
            return remaining;
          }
          // Weighted distributions for realistic results
          const maxVal = Math.floor(remaining * 0.7);
          const val = Math.max(2, Math.floor(Math.random() * maxVal));
          remaining -= val;
          return val;
        });

        // Map to slices
        const slices: ResponseSlice[] = options.map((opt, idx) => {
          const count = counts[idx];
          const percentage = Number(((count / total) * 100).toFixed(1));
          return {
            label: opt,
            count,
            percentage,
            color: colors[idx % colors.length],
          };
        });

        return {
          questionId: q.questionCode ?? q.id,
          questionText: q.questionText,
          answerType: q.answerType,
          slices,
        };
      }

      // 2. Numerical values
      if (q.answerType === "numeric") {
        const numericOptions = [
          "0 - 15 minutes",
          "15 - 30 minutes",
          "30 - 60 minutes",
          "Over 1 hour",
        ];
        const counts = [18, 14, 10, 6]; // Seed distribution

        const slices: ResponseSlice[] = numericOptions.map((opt, idx) => {
          const count = counts[idx];
          const percentage = Number(((count / total) * 100).toFixed(1));
          return {
            label: opt,
            count,
            percentage,
            color: colors[idx % colors.length],
          };
        });

        return {
          questionId: q.questionCode ?? q.id,
          questionText: q.questionText,
          answerType: q.answerType,
          slices,
        };
      }

      // 3. Text open ended responses
      return {
        questionId: q.questionCode ?? q.id,
        questionText: q.questionText,
        answerType: q.answerType,
        slices: [],
        textResponses: [
          "The main well is dry for almost 3 months in summer, forcing women to carry pots from the river.",
          "Sickness among children is common in monsoon. We need regular water tests.",
          "Our tap gets water only twice a week for 2 hours. Storage tanks are urgent.",
          "Water is salty and tastes bad. Many families buy bottled water if they can afford it.",
          "We need a filter system at the community well.",
        ],
      };
    });

    setStats(computedStats);
  };

  // No synchronous setState here: doing that inside the effect would trigger
  // a cascading render. Every flag is set from a settled promise instead.
  const loadData = useCallback(() => {
    studiesService
      .getById(id)
      .then(setStudy)
      .catch(() => undefined);

    surveysService
      .getSurveyByStudyId(id)
      .then((surveyData) => {
        setSurvey(surveyData);
        if (!surveyData) {
          setLoading(false);
          return;
        }
        surveysService
          .getSurveyResponses(surveyData.id)
          .then((statsResult) => {
            if (statsResult && statsResult.totalRespondents > 0) {
              setTotalRespondents(statsResult.totalRespondents);
              setStats(statsResult.stats);
              setIsDemoData(false);
            } else {
              generateStats(surveyData.questions);
              setIsDemoData(true);
            }
          })
          .catch((apiErr) => {
            console.warn(
              "Failed fetching live responses, falling back to mock visuals:",
              apiErr,
            );
            generateStats(surveyData.questions);
            setIsDemoData(true);
          })
          .finally(() => setLoading(false));
      })
      .catch((err) => {
        console.error("Failed loading data for responses dashboard:", err);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getDonutStyle = (slices: ResponseSlice[]) => {
    let accumulated = 0;
    const gradientParts = slices.map((slice) => {
      const start = accumulated;
      accumulated += slice.percentage;
      return `${slice.color} ${start}% ${accumulated}%`;
    });
    return {
      background: `conic-gradient(${gradientParts.join(", ")})`,
      borderRadius: "50%",
      width: "140px",
      height: "140px",
    };
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/studies/${id}/all-surveys`)}
            className="text-slate-650 shrink-0 rounded-full hover:bg-slate-100"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {study?.title || "Community Assessment"}
            </span>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Survey Responses Dashboard
              {isDemoData ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 uppercase"
                >
                  Demo Preview
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800 uppercase"
                >
                  Live Data
                </Badge>
              )}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="size-10 animate-spin text-violet-600" />
            <span className="text-sm font-semibold text-slate-500">
              Loading analysis charts...
            </span>
          </div>
        ) : !survey ? (
          <Card className="space-y-4 p-8 text-center">
            <h3 className="text-lg font-bold text-slate-700">No survey found</h3>
            <p className="text-sm text-slate-500">
              You need to generate and publish a survey first.
            </p>
            <Button
              onClick={() => router.push(`/studies/${id}/survey-builder`)}
              className="bg-violet-600 font-semibold text-white"
            >
              Go to Survey Builder
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-violet-50 p-3 text-violet-600">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase">
                      Total Responses
                    </span>
                    <span className="text-2xl font-bold text-slate-800">
                      {totalRespondents}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase">
                      Completion Rate
                    </span>
                    <span className="text-2xl font-bold text-slate-800">100%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-amber-50 p-3 text-amber-600">
                    <Calendar className="size-6" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </span>
                    <Badge className="mt-0.5 border-none bg-emerald-100 text-[10px] font-bold text-emerald-800">
                      {survey.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analysis List */}
            <div className="space-y-6">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-wider text-slate-800 uppercase">
                <ChartIcon className="size-5 text-violet-600" />
                Question-by-Question Analytics
              </h2>

              {stats.map((qStat, idx) => (
                <Card
                  key={qStat.questionId}
                  className="overflow-hidden rounded-xl border-slate-200/80 bg-white shadow-sm"
                >
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          Question {idx + 1} &bull; {qStat.questionId}
                        </span>
                        <CardTitle className="text-base leading-snug font-bold text-slate-800">
                          {qStat.questionText}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-slate-200 bg-white text-[9px] font-bold text-slate-600 capitalize"
                      >
                        {qStat.answerType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {qStat.slices.length > 0 ? (
                      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
                        {/* Conic Gradient Donut Chart */}
                        <div className="flex shrink-0 flex-col items-center gap-3">
                          <div
                            style={getDonutStyle(qStat.slices)}
                            className="relative flex items-center justify-center shadow-inner"
                          >
                            <div className="absolute flex h-[80px] w-[80px] items-center justify-center rounded-full bg-white shadow-sm">
                              <div className="text-center">
                                <span className="block text-[10px] leading-none font-semibold text-slate-400">
                                  TOTAL
                                </span>
                                <span className="text-lg leading-tight font-extrabold text-slate-700">
                                  {totalRespondents}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Donut chart breakdown
                          </span>
                        </div>

                        {/* Percentages Lists */}
                        <div className="w-full flex-1 space-y-4">
                          <div className="grid grid-cols-3 border-b pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            <div className="col-span-2">Response Option</div>
                            <div className="text-right">Votes / Share</div>
                          </div>

                          <div className="space-y-3.5">
                            {qStat.slices.map((slice) => (
                              <div key={slice.label} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                                    <span
                                      className="size-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: slice.color }}
                                    />
                                    <span className="truncate">{slice.label}</span>
                                  </div>
                                  <div className="shrink-0 text-right font-bold text-slate-800">
                                    {slice.count}{" "}
                                    <span className="font-normal text-slate-500">
                                      ({slice.percentage}%)
                                    </span>
                                  </div>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${slice.percentage}%`,
                                      backgroundColor: slice.color,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Qualitative verbatim entries
                      <div className="space-y-3">
                        <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          Verbatim Text Submissions
                        </span>
                        <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border bg-slate-50/50 pr-1">
                          {qStat.textResponses?.map((resp, rIdx) => (
                            <div
                              key={rIdx}
                              className="flex items-start gap-2.5 p-3 text-sm text-slate-700"
                            >
                              <MessageSquare className="mt-0.5 size-4 shrink-0 text-violet-500" />
                              <p className="leading-relaxed">&quot;{resp}&quot;</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
