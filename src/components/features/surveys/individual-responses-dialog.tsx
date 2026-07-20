import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initials } from "@/lib/utils";
import type { QuestionRespondentAnswer } from "@/lib/survey-response-stats";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

/** Every respondent's answer to one specific question — opened from that
 * question's "View Responses" button. Raw validation view: who answered
 * what, and when, nothing scored or aggregated here. */
export function IndividualResponsesDialog({
  open,
  onOpenChange,
  questionText,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionText: string;
  entries: QuestionRespondentAnswer[];
}) {
  const t = useTranslations("app.publicSurveys.responseSummary");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("individualResponsesTitle")}</DialogTitle>
          <DialogDescription>{questionText}</DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noResponses")}</p>
        ) : (
          <div className="divide-border divide-y">
            {entries.map((entry) => {
              const displayName = entry.respondentName || entry.contact;
              return (
                <div key={entry.responseId} className="flex items-start gap-3 py-3">
                  <Avatar size="sm" title={displayName} className="mt-0.5">
                    <AvatarFallback>{initials(displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-foreground text-sm font-medium">{displayName}</p>
                    <p className="text-foreground text-sm break-words">
                      {entry.answer ?? (
                        <span className="text-muted-foreground">{t("noAnswer")}</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("submittedOn", { date: formatDate(entry.submittedAt) })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
