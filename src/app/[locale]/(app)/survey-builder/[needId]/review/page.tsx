"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MapPin,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { LoadingButton } from "@/components/common/loading-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { titleCase } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";
import {
  surveysService,
  type Survey,
  type SurveyQuestionItem,
} from "@/services/surveys/surveys.service";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Read-only — no reorder/edit/remove affordances anywhere on this page.
 * The Approver reviews exactly what was submitted; any change they want has
 * to go back through Reject -> edits on the Survey Builder page -> resubmit. */
function QuestionSummary({
  question,
  number,
}: {
  question: SurveyQuestionItem;
  number: number;
}) {
  const t = useTranslations("app.surveyBuilder.review");
  return (
    <div className="border-border space-y-2.5 rounded-lg border p-4">
      <p className="text-foreground text-sm font-semibold">
        {t("questionNumber", { number })}
      </p>
      <div>
        <p className="text-muted-foreground text-xs font-medium">{t("questionLabel")}</p>
        <p className="text-foreground text-sm">{question.questionText}</p>
      </div>
      {question.indicator ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            {t("indicatorLabel")}
          </p>
          <p className="text-foreground text-sm">
            <span className="font-medium">{question.questionCode}</span> ·{" "}
            {question.indicator}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="font-normal">
          {titleCase(question.answerType)}
        </Badge>
        {question.isRequired ? (
          <Badge variant="secondary" className="font-normal">
            {t("requiredLabel")}
          </Badge>
        ) : null}
      </div>
      {question.answerOptions && question.answerOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {question.answerOptions.map((option) => (
            <Badge key={option} variant="secondary" className="font-normal">
              {option}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SurveyReviewPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.surveyBuilder.review");

  const [need, setNeed] = useState<Need | null>(null);
  const [study, setStudy] = useState<Study | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    needsService
      .getById(needId)
      .then(async (needResult) => {
        if (cancelled) return;
        setNeed(needResult);
        const [studyResult, surveyResult] = await Promise.all([
          studiesService.getById(needResult.studyId).catch(() => null),
          surveysService.getSurveyByNeedId(needId).catch(() => null),
        ]);
        if (cancelled) return;
        setStudy(studyResult);
        setSurvey(surveyResult);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needId]);

  async function approve() {
    if (!survey) return;
    setApproving(true);
    setError(null);
    try {
      const updated = await surveysService.approveAndPublish(survey.id);
      setSurvey({ ...survey, ...updated });
      setMessage(t("approvedMessage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setApproving(false);
    }
  }

  function openRejectDialog() {
    setComments("");
    setCommentsError(null);
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!survey) return;
    const trimmed = comments.trim();
    if (!trimmed) {
      setCommentsError(t("commentsRequired"));
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      const updated = await surveysService.rejectSurvey(survey.id, trimmed);
      setSurvey({ ...survey, ...updated, approverComments: trimmed });
      setRejectOpen(false);
      setMessage(t("rejectedMessage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setRejecting(false);
    }
  }

  const recommended = survey?.questions.filter((q) => !q.isCustom) ?? [];
  const additional = survey?.questions.filter((q) => q.isCustom) ?? [];
  const pendingApproval = survey?.status === "SUBMITTED";

  return (
    <PermissionGuard module="surveyBuilder" action="approve">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/survey-builder" label={t("backToList")} />
        </div>

        {!loaded ? (
          <div className="space-y-4">
            <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
            <div className="bg-muted h-48 animate-pulse rounded-md" />
          </div>
        ) : !survey ? (
          <Card>
            <CardContent className="text-muted-foreground p-6 text-center text-sm">
              {t("noSurveyYet")}
            </CardContent>
          </Card>
        ) : (
          <>
            <PageHeader
              title={survey.title}
              description={t("description")}
              actions={
                <Badge
                  variant="outline"
                  className={
                    pendingApproval
                      ? "bg-badge-warning text-badge-warning-foreground border-transparent"
                      : survey.status === "PUBLISHED"
                        ? "bg-badge-success text-badge-success-foreground border-transparent"
                        : undefined
                  }
                >
                  {t(`status.${survey.status}`)}
                </Badge>
              }
            />

            {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}
            {message ? (
              <p className="text-badge-success-foreground mb-4 text-sm">{message}</p>
            ) : null}

            {!pendingApproval ? (
              <div
                role="status"
                className="border-border bg-muted/40 mb-6 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <ClipboardList className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <p className="text-muted-foreground text-sm">
                  {t("nothingToReviewNote")}
                </p>
              </div>
            ) : null}

            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-foreground text-sm font-semibold">
                    {t("contextHeading")}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("studyLabel")}
                      </p>
                      <p className="text-foreground text-sm font-medium">
                        {study?.title ?? "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("needLabel")}
                      </p>
                      <p className="text-foreground text-sm font-medium">
                        {need?.title ?? "—"}
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("needStatementLabel")}
                      </p>
                      <p className="text-foreground text-sm whitespace-pre-wrap">
                        {need?.statement ?? "—"}
                      </p>
                    </div>
                    {need && need.village.length > 0 ? (
                      <div className="space-y-1.5 sm:col-span-2">
                        <p className="text-muted-foreground text-xs font-medium">
                          {t("villageLabel")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {need.village.map((village) => (
                            <Badge key={village} variant="secondary" className="gap-1">
                              <MapPin className="size-3" />
                              {village}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("aiClassificationLabel")}
                      </p>
                      {need?.domain && need?.subDomain ? (
                        <p className="text-foreground text-sm">
                          {need.domain} / {need.subDomain}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          {t("noClassification")}
                        </p>
                      )}
                      {need?.aiSuggestedDomain && need?.aiSuggestedSubDomain ? (
                        <p className="text-muted-foreground text-xs">
                          {t("aiSuggestedNote", {
                            domain: need.aiSuggestedDomain,
                            subDomain: need.aiSuggestedSubDomain,
                          })}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs font-medium">
                        {t("methodologyVersionLabel")}
                      </p>
                      <p className="text-foreground text-sm">
                        {survey.methodologyVersion ?? "—"}
                      </p>
                    </div>
                    {survey.submittedAt ? (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs font-medium">
                          {t("submittedAtLabel")}
                        </p>
                        <p className="text-foreground text-sm">
                          {formatDateTime(survey.submittedAt)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-foreground text-sm font-semibold">
                    {t("recommendedHeading")}
                  </h2>
                  {recommended.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {t("noRecommendedQuestions")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recommended.map((q, index) => (
                        <QuestionSummary key={q.id} question={q} number={index + 1} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-foreground text-sm font-semibold">
                    {t("additionalHeading")}
                  </h2>
                  {additional.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {t("noAdditionalQuestions")}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {additional.map((q, index) => (
                        <QuestionSummary
                          key={q.id}
                          question={q}
                          number={recommended.length + index + 1}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {pendingApproval ? (
              <div className="bg-background sticky bottom-0 mt-6 flex items-center justify-end gap-2.5 border-t py-4">
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive gap-1.5"
                  onClick={openRejectDialog}
                  disabled={approving || rejecting}
                >
                  <XCircle className="size-4" />
                  {t("reject")}
                </Button>
                <LoadingButton
                  isLoading={approving}
                  onClick={approve}
                  disabled={rejecting}
                  className="gap-1.5"
                  startIcon={<CheckCircle2 className="size-4" />}
                  text={approving ? t("approving") : t("approveAndPublish")}
                />
              </div>
            ) : null}
          </>
        )}

        <Dialog
          open={rejectOpen}
          onOpenChange={(open) => !rejecting && setRejectOpen(open)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("rejectDialogTitle")}</DialogTitle>
              <DialogDescription>{t("rejectDialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="reject-comments">
                {t("commentsLabel")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reject-comments"
                rows={5}
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  if (commentsError) setCommentsError(null);
                }}
                placeholder={t("commentsPlaceholder")}
                aria-invalid={commentsError ? true : undefined}
              />
              {commentsError ? (
                <p className="text-destructive text-sm">{commentsError}</p>
              ) : null}
            </div>

            {error ? (
              <p className="text-destructive flex items-center gap-1.5 text-sm">
                <AlertTriangle className="size-3.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectOpen(false)}
                disabled={rejecting}
              >
                {t("cancel")}
              </Button>
              <LoadingButton
                type="button"
                variant="destructive"
                isLoading={rejecting}
                onClick={confirmReject}
                text={rejecting ? t("rejecting") : t("confirmReject")}
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
