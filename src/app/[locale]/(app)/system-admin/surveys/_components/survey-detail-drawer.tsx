"use client";

import {
  Building2,
  ClipboardEdit,
  MapPin,
  Users,
  HelpCircle,
  Award,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiClient } from "@/services/api/client";

interface QuestionDto {
  id: string;
  order: number;
  questionText: string;
  answerType: string;
  isRequired: boolean;
}

interface FullSurveyDetail {
  id: string;
  title: string;
  needId: string;
  studyId: string | null;
  studyTitle: string | null;
  orgId: string | null;
  orgName: string | null;
  village: string;
  domainCategory: string;
  status: string;
  publicToken: string | null;
  methodologyVersionId: string | null;
  questionsCount: number;
  responseCount: number;
  evidenceCount: number;
  score: number | null;
  questions: QuestionDto[];
  responsesSummary: {
    total: number;
    citizenChannelCount: number;
    fieldCollectorCount: number;
  };
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
}

interface SurveyDetailDrawerProps {
  surveyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurveyDetailDrawer({
  surveyId,
  open,
  onOpenChange,
}: SurveyDetailDrawerProps) {
  const t = useTranslations("systemAdmin.surveys.drawer");
  const [data, setData] = useState<FullSurveyDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!surveyId || !open) return;

    apiClient
      .get<FullSurveyDetail>(`/surveys/${surveyId}`)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [surveyId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="text-primary flex items-center gap-2">
            <ClipboardEdit className="size-5" />
            <SheetTitle className="text-base font-semibold">{t("title")}</SheetTitle>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : data ? (
          <div className="space-y-6 pt-4">
            {/* Header Banner */}
            <div className="border-primary/20 bg-primary/5 flex items-start justify-between rounded-lg border p-4">
              <div>
                <h3 className="text-foreground mb-1 text-base font-bold">{data.title}</h3>
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-primary font-medium">{data.domainCategory}</span>
                  <span>•</span>
                  <span>{data.village}</span>
                  {data.orgName ? (
                    <>
                      <span>•</span>
                      <span className="text-foreground flex items-center gap-1 font-medium">
                        <Building2 className="text-primary size-3" />
                        {data.orgName}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  data.status === "survey_published"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 capitalize dark:text-emerald-400"
                    : "text-xs capitalize"
                }
              >
                {data.status.replace("_", " ")}
              </Badge>
            </div>

            {/* Overview Cards */}
            <div>
              <h4 className="text-foreground mb-2 text-xs font-semibold">
                {t("surveyInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <Building2 className="size-3.5" />
                    <span>{t("organization")}</span>
                  </div>
                  <p className="text-foreground font-medium">{data.orgName ?? "—"}</p>
                </Card>

                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <FileText className="size-3.5" />
                    <span>{t("linkedStudy")}</span>
                  </div>
                  <p className="text-foreground font-medium">{data.studyTitle ?? "—"}</p>
                </Card>

                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <MapPin className="size-3.5" />
                    <span>{t("village")}</span>
                  </div>
                  <p className="text-foreground font-medium">{data.village}</p>
                </Card>

                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <Award className="size-3.5 text-amber-500" />
                    <span>{t("scoreSnapshot")}</span>
                  </div>
                  <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {data.score !== null ? data.score.toFixed(1) : "—"}
                  </p>
                </Card>
              </div>
            </div>

            {/* Public Link Token (if published) */}
            {data.publicToken ? (
              <Card className="bg-muted/20 border-primary/20 p-3">
                <div className="text-primary mb-1 flex items-center gap-2 text-xs font-semibold">
                  <LinkIcon className="size-3.5" />
                  <span>{t("publicToken")}</span>
                </div>
                <p className="text-foreground bg-background border-border rounded border p-2 font-mono text-xs">
                  {data.publicToken}
                </p>
              </Card>
            ) : null}

            {/* Submitted Response Stats */}
            <div>
              <h4 className="text-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <Users className="text-primary size-4" />
                {t("responseStats")}
              </h4>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Card className="bg-primary/5 border-primary/20 p-3 text-center">
                  <span className="text-muted-foreground mb-0.5 block text-[10px]">
                    {t("totalResponses")}
                  </span>
                  <span className="text-primary font-mono text-lg font-bold">
                    {data.responsesSummary?.total ?? data.responseCount}
                  </span>
                </Card>
                <Card className="p-3 text-center">
                  <span className="text-muted-foreground mb-0.5 block text-[10px]">
                    {t("citizenSubmissions")}
                  </span>
                  <span className="text-foreground font-mono text-lg font-bold">
                    {data.responsesSummary?.citizenChannelCount ?? 0}
                  </span>
                </Card>
                <Card className="p-3 text-center">
                  <span className="text-muted-foreground mb-0.5 block text-[10px]">
                    {t("fieldCollectorSubmissions")}
                  </span>
                  <span className="text-foreground font-mono text-lg font-bold">
                    {data.responsesSummary?.fieldCollectorCount ?? 0}
                  </span>
                </Card>
              </div>
            </div>

            {/* Configured Survey Questions */}
            <div>
              <h4 className="text-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <HelpCircle className="text-primary size-4" />
                {t("questionsList")} ({data.questions?.length ?? 0})
              </h4>

              {!data.questions || data.questions.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">{t("noQuestions")}</p>
              ) : (
                <div className="space-y-2.5">
                  {data.questions.map((q, idx) => (
                    <Card key={q.id} className="space-y-1 p-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-foreground font-semibold">
                          {idx + 1}. <AutoTranslate text={q.questionText} />
                        </p>
                        {q.isRequired ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-600"
                          >
                            {t("required")}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px]">
                        <span>
                          {t("answerType")}: {q.answerType}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="border-border border-t pt-4">
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => onOpenChange(false)}
              >
                {t("close")}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
