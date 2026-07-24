import { Progress } from "@/components/ui/progress";
import type { QuestionOptionStat } from "@/lib/survey-response-stats";

/** One answer option per row — label, raw count, percentage, and a progress
 * bar for the percentage. Works the same way for Yes/No, single choice,
 * multi choice, a Likert/rating scale, or a dropdown — they're all just a
 * label + count to this component; the caller decides the label set.
 *
 * The count is the headline figure, not the percentage — "how many people
 * picked this" is the question researchers actually ask; percentage is
 * secondary context next to it. */
export function ResponseDistribution({ options }: { options: QuestionOptionStat[] }) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <div key={option.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-foreground text-sm font-medium">{option.label}</span>
            <span className="text-foreground text-sm font-semibold whitespace-nowrap tabular-nums">
              {option.count}{" "}
              <span className="text-muted-foreground font-normal">
                ({option.percentage}%)
              </span>
            </span>
          </div>
          <Progress value={option.percentage} />
        </div>
      ))}
    </div>
  );
}
