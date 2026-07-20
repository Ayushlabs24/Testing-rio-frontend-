import { ListChecks } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/** Survey Responses' header card — the survey/study identity, its status,
 * the two headline numbers (total responses, most recent one), and a way
 * into the full respondent-by-respondent list (the existing Public Surveys
 * responses table — search, per-respondent detail, CSV/Excel export — this
 * screen doesn't rebuild any of that, just links to it). Pure counts, no
 * scoring of any kind. */
export function SurveyResponseSummaryCard({
  needId,
  surveyTitle,
  studyTitle,
  status,
  totalResponses,
  lastResponseAt,
}: {
  needId: string;
  surveyTitle: string;
  studyTitle: string;
  status: string;
  totalResponses: number;
  lastResponseAt: string | null;
}) {
  const t = useTranslations("app.publicSurveys.responseSummary");

  return (
    <Card className="shadow-md">
      <CardContent className="flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">{studyTitle}</p>
          <h2 className="text-foreground text-lg font-semibold">{surveyTitle}</h2>
          <Badge
            variant={status === "DRAFT" ? "outline" : "default"}
            className={
              status !== "DRAFT"
                ? "bg-badge-success text-badge-success-foreground border-transparent"
                : undefined
            }
          >
            {status}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-8">
          <div className="space-y-1">
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {totalResponses}
            </p>
            <p className="text-muted-foreground text-xs">{t("totalResponsesLabel")}</p>
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-2xl font-semibold">
              {lastResponseAt ? formatDate(lastResponseAt) : "—"}
            </p>
            <p className="text-muted-foreground text-xs">{t("lastResponseLabel")}</p>
          </div>
          {totalResponses > 0 ? (
            <Button asChild variant="outline" className="gap-1.5 self-center">
              <Link href={`/public-surveys/${needId}/responses/all`}>
                <ListChecks className="size-4" />
                {t("viewAllResponses")}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
