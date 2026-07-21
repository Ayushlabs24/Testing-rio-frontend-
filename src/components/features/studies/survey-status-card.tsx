"use client";

import { ClipboardList, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/common/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePermission } from "@/hooks/use-permission";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import type { NeedStatus } from "@/services/needs/needs.types";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

type CreateMode = "ai" | "manual";

/**
 * Study Detail's Survey status — a lightweight status card, not the survey
 * editor itself. Question curation (reorder, add/remove, required/optional,
 * publish) all happens on the dedicated Survey Builder page
 * (/survey-builder/[studyId]); this card's only jobs are: (1) once AI
 * Classification is approved, offer "Create Survey" with a choice of AI
 * Suggestions vs. Build Manually, and (2) once a survey exists, show its
 * status and hand off to the builder — never duplicate the builder's own
 * question list here.
 */
export function SurveyStatusCard({
  needId,
  needStatus,
  domain,
  subDomain,
  aiSuggestedDomain,
  aiSuggestedSubDomain,
}: {
  needId: string;
  needStatus: NeedStatus;
  domain: string | null | undefined;
  subDomain: string | null | undefined;
  aiSuggestedDomain?: string | null;
  aiSuggestedSubDomain?: string | null;
}) {
  const t = useTranslations("app.studies.survey");
  const canWrite = usePermission("surveyBuilder", "write");
  const router = useRouter();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>("ai");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    surveysService
      .getSurveyByNeedId(needId)
      .then(setSurvey)
      .catch(() => undefined)
      .finally(() => setLoadingSurvey(false));
  }, [needId]);

  const hasDomain = Boolean(domain && subDomain);
  // Domain Category is set manually at Need creation (always present from
  // then on), so it no longer signals AI Classification review — that's a
  // separate condition Survey creation still requires: a human has to have
  // reviewed and approved the AI's classification (see
  // AiDecisionsService.review, SurveysService#assertClassificationApproved
  // on the backend, which enforces this same rule server-side).
  const classificationApproved =
    needStatus === "reviewer_approved" ||
    needStatus === "survey_created" ||
    needStatus === "survey_published";

  async function createSurvey() {
    setCreating(true);
    setError(null);
    try {
      if (mode === "ai") {
        await surveysService.recommendQuestions(needId);
      } else {
        await surveysService.createEmptySurvey(needId);
      }
      router.push(`/survey-builder/${needId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
      setCreating(false);
    }
  }

  async function submitForApproval() {
    if (!survey) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await surveysService.submitForApproval(survey.id);
      setSurvey({ ...survey, ...updated, approverComments: null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* Same tinted header-strip chrome as the other workflow sections
       * (Need, Evidence, AI Classification) on this page. */}
      <div className="bg-primary/5 border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
            <ClipboardList className="size-3.5" />
          </span>
          {t("heading")}
        </h2>
        {survey ? (
          <Badge className="border-transparent" variant="secondary">
            {t(`status.${survey.status}`)}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        {hasDomain ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">
              {t("classifiedAsLabel")}
            </p>
            <div className="border-border bg-muted/40 rounded-md border px-3.5 py-2.5">
              <p className="text-foreground text-sm font-medium">{domain}</p>
              <p className="text-muted-foreground text-sm">{subDomain}</p>
            </div>
            {aiSuggestedDomain && aiSuggestedSubDomain ? (
              <p className="text-muted-foreground text-xs">
                {t("aiSuggestedNote", {
                  domain: aiSuggestedDomain,
                  subDomain: aiSuggestedSubDomain,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Survey creation still needs a *reviewed and approved* AI
         * Classification, separately from the Domain Category above — see
         * classificationApproved's own comment for why these are now two
         * different conditions. */}
        {!classificationApproved ? (
          needStatus === "ai_classified" ? (
            <p className="text-muted-foreground text-sm">{t("awaitingReviewNote")}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{t("notEligibleNote")}</p>
          )
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {loadingSurvey ? (
          <div className="bg-muted h-9 w-40 animate-pulse rounded" />
        ) : survey ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={`/survey-builder/${needId}`}>
                <ClipboardList className="size-3.5" />
                {t("editSurvey")}
              </Link>
            </Button>
            {canWrite && (survey.status === "DRAFT" || survey.status === "REJECTED") ? (
              <LoadingButton
                size="sm"
                isLoading={submitting}
                onClick={submitForApproval}
                className="gap-1.5"
                text={submitting ? t("submitting") : t("submitForApproval")}
              />
            ) : null}
          </div>
        ) : canWrite ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              disabled={!classificationApproved}
              onClick={() => setDialogOpen(true)}
              className="gap-1.5"
            >
              <ClipboardList className="size-3.5" />
              {t("createSurvey")}
            </Button>
            {!classificationApproved ? (
              <p className="text-muted-foreground text-xs">{t("domainRequiredNote")}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noSurveyYet")}</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !creating && setDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("createDialogDescription")}</DialogDescription>
          </DialogHeader>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as CreateMode)}>
            <label className="border-border has-[[data-state=checked]]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3.5">
              <RadioGroupItem value="ai" className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                  <Sparkles className="size-3.5" />
                  {t("optionAiTitle")}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {t("optionAiDescription")}
                </span>
              </span>
            </label>
            <label className="border-border has-[[data-state=checked]]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3.5">
              <RadioGroupItem value="manual" className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="text-foreground text-sm font-medium">
                  {t("optionManualTitle")}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {t("optionManualDescription")}
                </span>
              </span>
            </label>
          </RadioGroup>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              {t("cancel")}
            </Button>
            <LoadingButton
              type="button"
              onClick={createSurvey}
              isLoading={creating}
              className="gap-1.5"
              text={creating ? t("creating") : t("continue")}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
