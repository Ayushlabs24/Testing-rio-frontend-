"use client";

import { ClipboardList, Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  studyId,
  domain,
  subDomain,
}: {
  studyId: string;
  domain: string | null | undefined;
  subDomain: string | null | undefined;
}) {
  const t = useTranslations("app.studies.survey");
  const canWrite = usePermission("surveyBuilder", "write");
  const router = useRouter();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<CreateMode>("ai");
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    surveysService
      .getSurveyByStudyId(studyId)
      .then(setSurvey)
      .catch(() => undefined)
      .finally(() => setLoadingSurvey(false));
  }, [studyId]);

  const domainApproved = Boolean(domain && subDomain);

  async function createSurvey() {
    setCreating(true);
    setError(null);
    try {
      if (mode === "ai") {
        await surveysService.recommendQuestions(studyId);
      } else {
        await surveysService.createEmptySurvey(studyId);
      }
      router.push(`/survey-builder/${studyId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
      setCreating(false);
    }
  }

  async function publishNow() {
    if (!survey) return;
    setPublishing(true);
    setError(null);
    try {
      await surveysService.saveDraft(survey.id, "PUBLISHED");
      setSurvey({ ...survey, status: "PUBLISHED" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <span className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-full">
            <ClipboardList className="size-3.5" />
          </span>
          {t("heading")}
        </h2>

        {domainApproved ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">{t("approvedDomainLabel")}</p>
              <Badge variant="secondary">{domain}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">
                {t("approvedSubDomainLabel")}
              </p>
              <Badge variant="secondary">{subDomain}</Badge>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("domainNotApprovedNote")}</p>
        )}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {loadingSurvey ? (
          <div className="bg-muted h-9 w-40 animate-pulse rounded" />
        ) : survey ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              className="border-transparent"
              variant={survey.status === "PUBLISHED" ? "default" : "secondary"}
            >
              {survey.status === "PUBLISHED" ? t("statusPublished") : t("statusCreated")}
            </Badge>
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link href={`/survey-builder/${studyId}`}>
                <ClipboardList className="size-3.5" />
                {t("editSurvey")}
              </Link>
            </Button>
            {canWrite && survey.status !== "PUBLISHED" ? (
              <Button
                size="sm"
                disabled={publishing}
                onClick={publishNow}
                className="gap-1.5"
              >
                {publishing ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {publishing ? t("publishing") : t("publishSurvey")}
              </Button>
            ) : null}
          </div>
        ) : canWrite ? (
          <div>
            <Button
              size="sm"
              disabled={!domainApproved}
              onClick={() => setDialogOpen(true)}
              className="gap-1.5"
            >
              <ClipboardList className="size-3.5" />
              {t("createSurvey")}
            </Button>
            {!domainApproved ? (
              <p className="text-muted-foreground mt-1.5 text-xs">
                {t("domainRequiredNote")}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noSurveyYet")}</p>
        )}
      </CardContent>

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
            <Button
              type="button"
              onClick={createSurvey}
              disabled={creating}
              className="gap-1.5"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              {creating ? t("creating") : t("continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
