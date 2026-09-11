"use client";

import { Building2, Calendar, ClipboardList, MapPin, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiClient } from "@/services/api/client";

interface AssociatedNeed {
  id: string;
  title: string;
  status: string;
  village: string;
  domainCategory: string;
  createdAt: string;
  responseCount: number;
  questionCount: number;
  score: number | null;
  evidenceCount: number;
}

interface FullStudyDetail {
  id: string;
  title: string;
  villages: string[];
  cycleNumber: number;
  orgName?: string;
  createdAt: string;
  needs?: AssociatedNeed[];
}

interface StudyDetailDrawerProps {
  studyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSurvey?: (surveyId: string) => void;
}

export function StudyDetailDrawer({
  studyId,
  open,
  onOpenChange,
  onSelectSurvey: _onSelectSurvey,
}: StudyDetailDrawerProps) {
  const t = useTranslations("systemAdmin.studies.drawer");
  const [data, setData] = useState<FullStudyDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!studyId || !open) return;

    apiClient
      .get<FullStudyDetail>(`/studies/${studyId}`)
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
  }, [studyId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="text-primary flex items-center gap-2">
            <ClipboardList className="size-5" />
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
            <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
              <h3 className="text-foreground mb-1 text-base font-bold">{data.title}</h3>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono">
                  Cycle #{data.cycleNumber}
                </Badge>
                {data.orgName ? (
                  <span className="text-foreground flex items-center gap-1 font-medium">
                    <Building2 className="text-primary size-3.5" />
                    {data.orgName}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Study Info */}
            <div>
              <h4 className="text-foreground mb-2 text-xs font-semibold">
                {t("studyInfo")}
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <MapPin className="size-3.5" />
                    <span>{t("villages")}</span>
                  </div>
                  <p className="text-foreground font-medium">
                    {data.villages?.length ? (
                      <AutoTranslate text={data.villages.join(", ")} />
                    ) : (
                      "—"
                    )}
                  </p>
                </Card>

                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <Calendar className="size-3.5" />
                    <span>{t("createdDate")}</span>
                  </div>
                  <p className="text-foreground font-mono font-medium">
                    <FormattedDate value={data.createdAt} />
                  </p>
                </Card>
              </div>
            </div>

            {/* Associated Needs & Surveys */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                  <Layers className="text-primary size-4" />
                  {t("associatedSurveys")} ({data.needs?.length ?? 0})
                </h4>
              </div>

              {!data.needs || data.needs.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">{t("noSurveys")}</p>
              ) : (
                <div className="space-y-3">
                  {data.needs.map((need) => (
                    <Card
                      key={need.id}
                      className="hover:border-primary/40 space-y-2 p-3 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-foreground text-xs font-semibold">
                            <AutoTranslate text={need.title} />
                          </p>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
                            <span className="text-primary font-medium">
                              <AutoTranslate text={need.domainCategory} />
                            </span>
                            <span>•</span>
                            <span>
                              <AutoTranslate text={need.village} />
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            need.status === "survey_published"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 capitalize dark:text-emerald-400"
                              : "text-[10px] capitalize"
                          }
                        >
                          {need.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* Stat Metrics Pill Grid */}
                      <div className="border-border grid grid-cols-4 gap-2 border-t pt-1 text-[11px]">
                        <div className="bg-muted/30 rounded p-1.5 text-center">
                          <span className="text-muted-foreground block text-[9px]">
                            {t("questions")}
                          </span>
                          <span className="text-foreground font-mono font-bold">
                            {need.questionCount}
                          </span>
                        </div>
                        <div className="bg-muted/30 rounded p-1.5 text-center">
                          <span className="text-muted-foreground block text-[9px]">
                            {t("responses")}
                          </span>
                          <span className="text-primary font-mono font-bold">
                            {need.responseCount}
                          </span>
                        </div>
                        <div className="bg-muted/30 rounded p-1.5 text-center">
                          <span className="text-muted-foreground block text-[9px]">
                            {t("score")}
                          </span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {need.score !== null ? need.score.toFixed(1) : "—"}
                          </span>
                        </div>
                        <div className="bg-muted/30 rounded p-1.5 text-center">
                          <span className="text-muted-foreground block text-[9px]">
                            {t("evidences")}
                          </span>
                          <span className="text-foreground font-mono font-bold">
                            {need.evidenceCount}
                          </span>
                        </div>
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
