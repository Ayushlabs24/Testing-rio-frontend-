import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponseDistribution } from "@/components/features/surveys/response-distribution";
import {
  describeAnswerType,
  type QuestionResponseStat,
} from "@/lib/survey-response-stats";

const TEXT_PREVIEW_COUNT = 3;
const TEXT_PREVIEW_MAX_CHARS = 110;

function truncate(text: string): string {
  return text.length > TEXT_PREVIEW_MAX_CHARS
    ? `${text.slice(0, TEXT_PREVIEW_MAX_CHARS).trimEnd()}…`
    : text;
}

/** One question's response summary — the distribution/numeric summary
 * shape depends entirely on `stat.kind` (set by computeQuestionStats from
 * the question's own answerType, never guessed here), plus a "View
 * Responses" button that hands off to the caller's single shared dialog
 * instance rather than each card owning its own. */
export function QuestionResponseCard({
  stat,
  onViewResponses,
}: {
  stat: QuestionResponseStat;
  onViewResponses: () => void;
}) {
  const t = useTranslations("app.publicSurveys.responseSummary");

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-foreground text-sm font-semibold">{stat.questionText}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {describeAnswerType(stat.answerType)}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {t("responseCount", { count: stat.totalAnswered })}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            onClick={onViewResponses}
          >
            <Eye className="size-3.5" />
            {t("viewResponses")}
          </Button>
        </div>

        {stat.kind === "options" ? (
          stat.totalAnswered > 0 ? (
            <ResponseDistribution options={stat.options} />
          ) : (
            <p className="text-muted-foreground text-sm">{t("noResponses")}</p>
          )
        ) : stat.kind === "numeric" ? (
          stat.numeric ? (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border-border rounded-md border p-3">
                <p className="text-foreground text-lg font-semibold tabular-nums">
                  {stat.numeric.min}
                </p>
                <p className="text-muted-foreground text-xs">{t("minLabel")}</p>
              </div>
              <div className="border-border rounded-md border p-3">
                <p className="text-foreground text-lg font-semibold tabular-nums">
                  {stat.numeric.max}
                </p>
                <p className="text-muted-foreground text-xs">{t("maxLabel")}</p>
              </div>
              <div className="border-border rounded-md border p-3">
                <p className="text-foreground text-lg font-semibold tabular-nums">
                  {stat.numeric.average}
                </p>
                <p className="text-muted-foreground text-xs">{t("averageLabel")}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t("noResponses")}</p>
          )
        ) : stat.textAnswers.length > 0 ? (
          <ul className="space-y-1.5">
            {stat.textAnswers.slice(0, TEXT_PREVIEW_COUNT).map((answer, index) => (
              <li
                // Preview text isn't a stable identity — a respondent could
                // submit the exact same wording as someone else — so this
                // is keyed on its fixed position in a fixed-length preview
                // slice, not the text itself.
                key={index}
                className="text-foreground flex gap-2 text-sm"
              >
                <span className="text-muted-foreground">•</span>
                <span className="min-w-0 flex-1 break-words">{truncate(answer)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noResponses")}</p>
        )}
      </CardContent>
    </Card>
  );
}
