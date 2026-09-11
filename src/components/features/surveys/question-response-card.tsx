import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { useAutoTranslate } from "@/hooks/use-auto-translate";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponseDistribution } from "@/components/features/surveys/response-distribution";
import { Link } from "@/i18n/navigation";
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

/** Translates a respondent's open-text answer (if the UI locale doesn't
 * match what they typed) before truncating it for the preview — truncating
 * first and translating the cut fragment would risk an odd, mid-word
 * translation of a sentence that was never meant to end there. */
function TextAnswerPreview({ answer }: { answer: string }) {
  const { text } = useAutoTranslate(answer);
  return <>{truncate(text)}</>;
}

/** One question's response summary — the distribution/numeric summary
 * shape depends entirely on `stat.kind` (set by computeQuestionStats from
 * the question's own answerType, never guessed here), plus a "View
 * Responses" link to that question's own dedicated, paginated responses
 * page (a survey can collect thousands of responses — a dialog that lists
 * them all in one scrolling list doesn't hold up at that scale). */
export function QuestionResponseCard({
  needId,
  stat,
}: {
  needId: string;
  stat: QuestionResponseStat;
}) {
  const t = useTranslations("app.publicSurveys.responseSummary");

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p dir="auto" className="text-foreground text-sm font-semibold">
              <AutoTranslate text={stat.questionText} />
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {describeAnswerType(stat.answerType, t)}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {t("responseCount", { count: stat.totalAnswered })}
              </span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
            <Link
              href={`/public-surveys/${needId}/responses/questions/${stat.questionId}`}
            >
              <Eye className="size-3.5" />
              {t("viewResponses")}
            </Link>
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
                <span dir="auto" className="min-w-0 flex-1 break-words">
                  <TextAnswerPreview answer={answer} />
                </span>
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
