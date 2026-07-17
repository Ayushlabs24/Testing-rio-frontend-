"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  PieChart as ChartIcon,
  BarChart3,
  Users,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Download
} from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";
import { surveysService, type Survey, type Question } from "@/services/surveys/surveys.service";

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

export default function SurveyResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [study, setStudy] = useState<Study | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuestionStats[]>([]);
  const [totalRespondents, setTotalRespondents] = useState(48);
  const [isDemoData, setIsDemoData] = useState(false);

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const studyData = await studiesService.getById(id);
      setStudy(studyData);
      
      const surveyData = await surveysService.getSurveyByStudyId(id);
      setSurvey(surveyData);

      if (surveyData) {
        try {
          const statsResult = await surveysService.getSurveyResponses(surveyData.id);
          if (statsResult && statsResult.totalRespondents > 0) {
            setTotalRespondents(statsResult.totalRespondents);
            setStats(statsResult.stats);
            setIsDemoData(false);
          } else {
            generateStats(surveyData.questions);
            setIsDemoData(true);
          }
        } catch (apiErr) {
          console.warn("Failed fetching live responses, falling back to mock visuals:", apiErr);
          generateStats(surveyData.questions);
          setIsDemoData(true);
        }
      }
    } catch (err) {
      console.error("Failed loading data for responses dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

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
            color: colors[idx % colors.length]
          };
        });

        return {
          questionId: q.questionId,
          questionText: q.questionText,
          answerType: q.answerType,
          slices
        };
      }
      
      // 2. Numerical values
      if (q.answerType === "numeric") {
        const numericOptions = ["0 - 15 minutes", "15 - 30 minutes", "30 - 60 minutes", "Over 1 hour"];
        const counts = [18, 14, 10, 6]; // Seed distribution
        
        const slices: ResponseSlice[] = numericOptions.map((opt, idx) => {
          const count = counts[idx];
          const percentage = Number(((count / total) * 100).toFixed(1));
          return {
            label: opt,
            count,
            percentage,
            color: colors[idx % colors.length]
          };
        });

        return {
          questionId: q.questionId,
          questionText: q.questionText,
          answerType: q.answerType,
          slices
        };
      }

      // 3. Text open ended responses
      return {
        questionId: q.questionId,
        questionText: q.questionText,
        answerType: q.answerType,
        slices: [],
        textResponses: [
          "The main well is dry for almost 3 months in summer, forcing women to carry pots from the river.",
          "Sickness among children is common in monsoon. We need regular water tests.",
          "Our tap gets water only twice a week for 2 hours. Storage tanks are urgent.",
          "Water is salty and tastes bad. Many families buy bottled water if they can afford it.",
          "We need a filter system at the community well."
        ]
      };
    });

    setStats(computedStats);
  };

  const getDonutStyle = (slices: ResponseSlice[]) => {
    let accumulated = 0;
    const gradientParts = slices.map(slice => {
      const start = accumulated;
      accumulated += slice.percentage;
      return `${slice.color} ${start}% ${accumulated}%`;
    });
    return {
      background: `conic-gradient(${gradientParts.join(', ')})`,
      borderRadius: '50%',
      width: '140px',
      height: '140px',
    };
  };

  return (
    <PageContainer>
      <div className="space-y-6 max-w-4xl mx-auto">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/studies/${id}/all-surveys`)}
            className="text-slate-650 hover:bg-slate-100 rounded-full shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {study?.title || "Community Assessment"}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Survey Responses Dashboard
              {isDemoData ? (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 font-bold text-[9px] uppercase px-2 py-0.5">
                  Demo Preview
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[9px] uppercase px-2 py-0.5">
                  Live Data
                </Badge>
              )}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-10 animate-spin text-violet-600" />
            <span className="text-sm font-semibold text-slate-500">Loading analysis charts...</span>
          </div>
        ) : !survey ? (
          <Card className="p-8 text-center space-y-4">
            <h3 className="font-bold text-slate-700 text-lg">No survey found</h3>
            <p className="text-sm text-slate-500">You need to generate and publish a survey first.</p>
            <Button onClick={() => router.push(`/studies/${id}/survey-builder`)} className="bg-violet-600 text-white font-semibold">
              Go to Survey Builder
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="bg-violet-50 text-violet-600 p-3 rounded-lg">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase">Total Responses</span>
                    <span className="text-2xl font-bold text-slate-800">{totalRespondents}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase">Completion Rate</span>
                    <span className="text-2xl font-bold text-slate-800">100%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200/80 shadow-sm rounded-xl">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="bg-amber-50 text-amber-600 p-3 rounded-lg">
                    <Calendar className="size-6" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block uppercase">Status</span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-[10px] mt-0.5">
                      {survey.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analysis List */}
            <div className="space-y-6">
              <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ChartIcon className="size-5 text-violet-600" />
                Question-by-Question Analytics
              </h2>

              {stats.map((qStat, idx) => (
                <Card key={qStat.questionId} className="bg-white border-slate-200/80 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          Question {idx + 1} &bull; {qStat.questionId}
                        </span>
                        <CardTitle className="text-base font-bold text-slate-800 leading-snug">
                          {qStat.questionText}
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 capitalize text-[9px] font-bold shrink-0">
                        {qStat.answerType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {qStat.slices.length > 0 ? (
                      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                        
                        {/* Conic Gradient Donut Chart */}
                        <div className="shrink-0 flex flex-col items-center gap-3">
                          <div style={getDonutStyle(qStat.slices)} className="relative flex items-center justify-center shadow-inner">
                            <div className="absolute w-[80px] h-[80px] bg-white rounded-full flex items-center justify-center shadow-sm">
                              <div className="text-center">
                                <span className="text-[10px] font-semibold text-slate-400 block leading-none">TOTAL</span>
                                <span className="text-lg font-extrabold text-slate-700 leading-tight">{totalRespondents}</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Donut chart breakdown</span>
                        </div>

                        {/* Percentages Lists */}
                        <div className="flex-1 w-full space-y-4">
                          <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b">
                            <div className="col-span-2">Response Option</div>
                            <div className="text-right">Votes / Share</div>
                          </div>

                          <div className="space-y-3.5">
                            {qStat.slices.map((slice) => (
                              <div key={slice.label} className="space-y-1.5">
                                <div className="flex justify-between items-center text-sm">
                                  <div className="flex items-center gap-2 font-medium text-slate-700 min-w-0">
                                    <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                                    <span className="truncate">{slice.label}</span>
                                  </div>
                                  <div className="text-right font-bold text-slate-800 shrink-0">
                                    {slice.count} <span className="font-normal text-slate-500">({slice.percentage}%)</span>
                                  </div>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${slice.percentage}%`,
                                      backgroundColor: slice.color
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
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verbatim Text Submissions</span>
                        <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1 border rounded-lg bg-slate-50/50">
                          {qStat.textResponses?.map((resp, rIdx) => (
                            <div key={rIdx} className="p-3 text-sm text-slate-700 flex gap-2.5 items-start">
                              <MessageSquare className="size-4 text-violet-500 shrink-0 mt-0.5" />
                              <p className="leading-relaxed">"{resp}"</p>
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
