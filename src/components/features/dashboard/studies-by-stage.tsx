"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Stage {
  key: string;
  label: string;
  count: number;
  color: string;
}

interface StudiesByStageProps {
  surveyInReview?: number;
  collecting?: number;
  reportInReview?: number;
  published?: number;
  className?: string;
}

export function StudiesByStage({
  surveyInReview = 0,
  collecting = 0,
  reportInReview = 0,
  published = 0,
  className,
}: StudiesByStageProps) {
  const t = useTranslations("systemAdmin.dashboard");
  const total = surveyInReview + collecting + reportInReview + published || 1;

  const stages: Stage[] = [
    {
      key: "surveyInReview",
      label: t("surveyInReview"),
      count: surveyInReview,
      color: "bg-amber-500",
    },
    {
      key: "collecting",
      label: t("collecting"),
      count: collecting,
      color: "bg-primary",
    },
    {
      key: "reportInReview",
      label: t("reportInReview"),
      count: reportInReview,
      color: "bg-purple-500",
    },
    {
      key: "published",
      label: t("published"),
      count: published,
      color: "bg-emerald-500",
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-foreground text-base font-bold">{t("studiesByStage")}</h3>
      <div className="space-y-3.5">
        {stages.map((stage) => {
          const pct = Math.round((stage.count / total) * 100);
          return (
            <div key={stage.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-semibold">{stage.label}</span>
                <span className="text-muted-foreground font-bold tabular-nums">
                  {stage.count}
                </span>
              </div>
              <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    stage.color,
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
