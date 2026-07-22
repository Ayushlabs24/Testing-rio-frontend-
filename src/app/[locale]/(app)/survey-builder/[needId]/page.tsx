"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { usePermission } from "@/hooks/use-permission";
import { cn, titleCase } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { methodologyConfigService } from "@/services/methodology-config/methodology-config.service";
import type { MethodologyVersionOption } from "@/services/methodology-config/methodology-config.types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import {
  ADDITIONAL_QUESTION_ANSWER_TYPES,
  surveysService,
  type AdditionalQuestionAnswerType,
  type Question,
  type SaveSurveyQuestionInput,
  type Survey,
  type SurveyQuestionItem,
} from "@/services/surveys/surveys.service";

const STATUS_BADGE_CLASS: Record<Survey["status"], string | undefined> = {
  DRAFT: undefined,
  SUBMITTED: "bg-badge-warning text-badge-warning-foreground border-transparent",
  REJECTED: "bg-destructive/10 text-destructive border-transparent",
  PUBLISHED: "bg-badge-success text-badge-success-foreground border-transparent",
};

let tempIdCounter = 0;
function nextTempId(prefix: string): string {
  tempIdCounter += 1;
  return `${prefix}-${tempIdCounter}`;
}

const OPTIONS_ANSWER_TYPES = new Set<AdditionalQuestionAnswerType>([
  "multiple_choice",
  "checkbox",
]);

export default function SurveyBuilderDetailPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.surveyBuilder.detail");
  const canWrite = usePermission("surveyBuilder", "write");
  const canApprove = usePermission("surveyBuilder", "approve");

  const [need, setNeed] = useState<Need | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [eligibleQuestions, setEligibleQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Draft — the two sections editable locally, only persisted on Save. Kept
  // apart (rather than one array) since the UI, save-validation, and
  // add/remove behavior genuinely differ per kind.
  const [recommended, setRecommended] = useState<SurveyQuestionItem[]>([]);
  const [additional, setAdditional] = useState<SurveyQuestionItem[]>([]);
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // TEMPORARY — see MethodologyVersionOption's doc comment. Mandatory
  // before Submit for Approval; the Researcher picks it here, the Approver
  // only ever reviews/publishes whatever was chosen (see the Review page).
  const [methodologyOptions, setMethodologyOptions] = useState<
    MethodologyVersionOption[]
  >([]);
  const [savingMethodologyVersion, setSavingMethodologyVersion] = useState(false);

  // The Researcher only edits/saves/submits from DRAFT or REJECTED — once
  // SUBMITTED, content is frozen for the Approver's review; once PUBLISHED,
  // it's frozen for good. The backend enforces this too (SURVEY_NOT_EDITABLE);
  // this just keeps the UI from offering actions that would 409.
  const isEditable =
    canWrite && (survey?.status === "DRAFT" || survey?.status === "REJECTED");

  // Additional Question modal — add or edit one question at a time,
  // instead of the page growing with an ever-longer inline editable list.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftAnswerType, setDraftAnswerType] =
    useState<AdditionalQuestionAnswerType>("long_text");
  const [draftOptions, setDraftOptions] = useState<string[]>(["", ""]);
  const [draftRequired, setDraftRequired] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);

  function loadDraftFromSurvey(s: Survey | null) {
    setRecommended((s?.questions ?? []).filter((q) => !q.isCustom));
    setAdditional((s?.questions ?? []).filter((q) => q.isCustom));
    setDirty(false);
  }

  function load() {
    Promise.all([needsService.getById(needId), surveysService.getSurveyByNeedId(needId)])
      .then(([needResult, surveyResult]) => {
        setNeed(needResult);
        setSurvey(surveyResult);
        loadDraftFromSurvey(surveyResult);
        if (needResult.domain && needResult.subDomain) {
          surveysService
            .getQuestions(needResult.domain, needResult.subDomain)
            .then(setEligibleQuestions)
            .catch(() => setEligibleQuestions([]));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId]);

  useEffect(() => {
    methodologyConfigService
      .listVersionOptions()
      .then(setMethodologyOptions)
      .catch(() => undefined);
  }, []);

  async function changeMethodologyVersion(version: string) {
    if (!survey) return;
    setSavingMethodologyVersion(true);
    setError(null);
    try {
      const updated = await surveysService.setMethodologyVersion(survey.id, version);
      setSurvey(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSavingMethodologyVersion(false);
    }
  }

  function moveRecommended(index: number, direction: -1 | 1) {
    setRecommended((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  function removeRecommended(id: string) {
    setRecommended((prev) => prev.filter((q) => q.id !== id));
    setDirty(true);
  }

  function toggleRecommendedRequired(id: string) {
    setRecommended((prev) =>
      prev.map((q) => (q.id === id ? { ...q, isRequired: !q.isRequired } : q)),
    );
    setDirty(true);
  }

  function addFromQuestionBank(bankQuestionId: string) {
    const question = eligibleQuestions.find((q) => q.id === bankQuestionId);
    if (!question) return;
    setRecommended((prev) => [
      ...prev,
      {
        id: nextTempId("bank"),
        bankQuestionId: question.id,
        questionCode: question.questionId,
        questionText: question.questionText,
        answerType: question.answerType,
        answerOptions: question.answerOptions ?? null,
        indicator: question.indicator ?? null,
        kpi: question.kpi ?? null,
        isCustom: false,
        order: prev.length + 1,
        isRequired: question.requiredOptional === "required",
      },
    ]);
    setDirty(true);
  }

  function resetModalDraft() {
    setDraftText("");
    setDraftAnswerType("long_text");
    setDraftOptions(["", ""]);
    setDraftRequired(true);
    setModalError(null);
  }

  function openAddModal() {
    setEditingId(null);
    resetModalDraft();
    setModalOpen(true);
  }

  function openEditModal(item: SurveyQuestionItem) {
    setEditingId(item.id);
    setDraftText(item.questionText);
    setDraftAnswerType((item.answerType as AdditionalQuestionAnswerType) || "long_text");
    setDraftOptions(
      item.answerOptions && item.answerOptions.length > 0 ? item.answerOptions : ["", ""],
    );
    setDraftRequired(item.isRequired);
    setModalError(null);
    setModalOpen(true);
  }

  function saveModalQuestion() {
    const text = draftText.trim();
    if (!text) {
      setModalError(t("openEndedTextRequired"));
      return;
    }
    const needsOptions = OPTIONS_ANSWER_TYPES.has(draftAnswerType);
    const cleanedOptions = draftOptions.map((o) => o.trim()).filter(Boolean);
    if (needsOptions && cleanedOptions.length < 2) {
      setModalError(t("openEndedOptionsRequired"));
      return;
    }

    setAdditional((prev) => {
      if (editingId) {
        return prev.map((q) =>
          q.id === editingId
            ? {
                ...q,
                questionText: text,
                answerType: draftAnswerType,
                answerOptions: needsOptions ? cleanedOptions : null,
                isRequired: draftRequired,
              }
            : q,
        );
      }
      return [
        ...prev,
        {
          id: nextTempId("custom"),
          bankQuestionId: null,
          questionCode: null,
          questionText: text,
          answerType: draftAnswerType,
          answerOptions: needsOptions ? cleanedOptions : null,
          indicator: null,
          kpi: null,
          isCustom: true,
          order: recommended.length + prev.length + 1,
          isRequired: draftRequired,
        },
      ];
    });
    setDirty(true);
    setModalOpen(false);
    resetModalDraft();
    setEditingId(null);
  }

  function removeAdditional(id: string) {
    setAdditional((prev) => prev.filter((q) => q.id !== id));
    setDirty(true);
  }

  function updateDraftOption(index: number, value: string) {
    setDraftOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  function addDraftOption() {
    setDraftOptions((prev) => [...prev, ""]);
  }

  function removeDraftOption(index: number) {
    setDraftOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!survey) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: SaveSurveyQuestionInput[] = [
        ...recommended.map((q, index) => ({
          questionId: q.bankQuestionId as string,
          order: index + 1,
          isRequired: q.isRequired,
        })),
        ...additional.map((q, index) => ({
          customText: q.questionText.trim(),
          customAnswerType: q.answerType,
          customOptions: q.answerOptions ?? undefined,
          order: recommended.length + index + 1,
          isRequired: q.isRequired,
        })),
      ];
      const updated = await surveysService.updateQuestions(survey.id, payload);
      setSurvey(updated);
      loadDraftFromSurvey(updated);
      setMessage(t("saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSaving(false);
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

  const needsOptionsEditor = OPTIONS_ANSWER_TYPES.has(draftAnswerType);

  return (
    <PermissionGuard module="surveyBuilder" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/survey-builder" label={t("backToList")} />
        </div>

        {!loaded ? (
          <div className="space-y-4">
            <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
            <div className="bg-muted h-48 animate-pulse rounded-md" />
          </div>
        ) : (
          <>
            <PageHeader
              title={need?.title ?? ""}
              description={
                need?.domain && need?.subDomain
                  ? `${need.domain} / ${need.subDomain}`
                  : undefined
              }
              actions={
                survey ? (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[survey.status]}
                    >
                      {t(`status.${survey.status}`)}
                    </Badge>
                    {canApprove && !canWrite && survey.status === "SUBMITTED" ? (
                      <Button asChild size="sm" className="gap-1.5">
                        <Link href={`/survey-builder/${needId}/review`}>
                          {t("goToReview")}
                        </Link>
                      </Button>
                    ) : null}
                    {isEditable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={save}
                        disabled={saving}
                        className="gap-1.5"
                      >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {saving ? t("saving") : t("saveDraft")}
                      </Button>
                    ) : null}
                    {isEditable ? (
                      <Button
                        size="sm"
                        onClick={submitForApproval}
                        disabled={submitting || dirty || !survey.methodologyVersion}
                        title={
                          dirty
                            ? t("saveBeforeSubmit")
                            : !survey.methodologyVersion
                              ? t("methodologyVersionRequiredNote")
                              : undefined
                        }
                      >
                        {submitting ? t("submitting") : t("submitForApproval")}
                      </Button>
                    ) : null}
                  </div>
                ) : null
              }
            />

            {survey?.status === "SUBMITTED" ? (
              <div
                role="status"
                className="border-badge-warning/40 bg-badge-warning/10 mb-4 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <Clock className="text-badge-warning-foreground mt-0.5 size-4 shrink-0" />
                <p className="text-badge-warning-foreground text-sm">
                  {t("submittedNotice")}
                </p>
              </div>
            ) : null}

            {survey?.status === "REJECTED" && survey.approverComments ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/5 mb-4 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-destructive text-sm font-medium">
                    {t("rejectedNoticeTitle")}
                  </p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {survey.approverComments}
                  </p>
                </div>
              </div>
            ) : null}

            {dirty ? (
              <p className="text-muted-foreground mb-4 text-xs">
                {t("unsavedChangesNote")}
              </p>
            ) : null}
            {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}
            {message ? (
              <p className="text-badge-success-foreground mb-4 text-sm">{message}</p>
            ) : null}

            {!survey ? (
              <Card>
                <CardContent className="text-muted-foreground p-6 text-center text-sm">
                  {t("noSurveyYet")}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardContent className="space-y-2 p-6">
                    <Label htmlFor="methodology-version">
                      {t("methodologyVersionLabel")}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={survey.methodologyVersion ?? undefined}
                      onValueChange={changeMethodologyVersion}
                      disabled={!isEditable || savingMethodologyVersion}
                    >
                      <SelectTrigger id="methodology-version" className="w-full sm:w-96">
                        <SelectValue placeholder={t("methodologyVersionPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {methodologyOptions.map((option) => (
                          <SelectItem key={option.id} value={option.version}>
                            {option.version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground text-xs">
                      {isEditable
                        ? t("methodologyVersionHint")
                        : t("methodologyVersionLockedHint")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-6">
                    <Tabs defaultValue="recommended">
                      <div className="overflow-x-auto">
                        <TabsList variant="line" size="lg">
                          <TabsTrigger value="recommended" size="lg">
                            {t("recommendedHeading")}
                          </TabsTrigger>
                          <TabsTrigger value="questionBank" size="lg">
                            {t("questionBankTab")}
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="questionBank" className="mt-6 space-y-4">
                        {/* Every Question Bank row for this Need's classified
                            domain/sub-domain — the same `eligibleQuestions` the
                            combobox draws from, browsable in full rather than
                            one search-and-select at a time. */}
                        <p className="text-muted-foreground text-xs">
                          {need?.domain && need?.subDomain
                            ? t("questionBankDescription", {
                                domain: need.domain,
                                subDomain: need.subDomain,
                              })
                            : t("questionBankNoDomain")}
                        </p>

                        {eligibleQuestions.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            {t("questionBankEmpty")}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {eligibleQuestions.map((q) => {
                              const added = recommended.some(
                                (included) => included.bankQuestionId === q.id,
                              );
                              return (
                                <div
                                  key={q.id}
                                  className={cn(
                                    "space-y-2.5 rounded-lg border p-4",
                                    added
                                      ? "border-badge-success/40 bg-badge-success/5"
                                      : "border-border",
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-foreground text-sm">
                                      {q.questionText}
                                    </p>
                                    {isEditable ? (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant={added ? "secondary" : "outline"}
                                        className={cn(
                                          "size-8 shrink-0",
                                          added &&
                                            "bg-badge-success text-badge-success-foreground hover:bg-badge-success",
                                        )}
                                        // Already-in-survey rows keep the tick
                                        // visible but inert — clicking again
                                        // would add a duplicate.
                                        disabled={added}
                                        onClick={() => addFromQuestionBank(q.id)}
                                        aria-label={
                                          added ? t("alreadyAdded") : t("addToSurvey")
                                        }
                                        title={
                                          added ? t("alreadyAdded") : t("addToSurvey")
                                        }
                                      >
                                        <Check className="size-4" />
                                      </Button>
                                    ) : null}
                                  </div>

                                  {q.indicator ? (
                                    <div>
                                      <p className="text-muted-foreground text-xs font-medium">
                                        {t("indicatorLabel")}
                                      </p>
                                      <p className="text-foreground text-sm">
                                        <span className="font-medium">
                                          {q.questionId}
                                        </span>{" "}
                                        · {q.indicator}
                                      </p>
                                    </div>
                                  ) : null}

                                  <div>
                                    <p className="text-muted-foreground text-xs font-medium">
                                      {t("answerTypeLabel")}
                                    </p>
                                    <Badge variant="outline" className="mt-0.5">
                                      {titleCase(q.answerType)}
                                    </Badge>
                                  </div>

                                  {q.answerOptions && q.answerOptions.length > 0 ? (
                                    <div>
                                      <p className="text-muted-foreground text-xs font-medium">
                                        {t("optionsLabel")}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1.5">
                                        {q.answerOptions.map((option) => (
                                          <Badge
                                            key={option}
                                            variant="secondary"
                                            className="font-normal"
                                          >
                                            {option}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {added ? (
                                    <Badge className="bg-badge-success text-badge-success-foreground gap-1 border-transparent font-normal">
                                      <Check className="size-3" />
                                      {t("alreadyAdded")}
                                    </Badge>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="recommended" className="mt-6 space-y-4">
                        {recommended.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            {t("noRecommendedQuestions")}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {recommended.map((q, index) => (
                              <div
                                key={q.id}
                                className="border-border space-y-2.5 rounded-lg border p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-foreground text-sm font-semibold">
                                    {t("questionNumber", { number: index + 1 })}
                                  </p>
                                  {isEditable ? (
                                    <div className="flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => moveRecommended(index, -1)}
                                        disabled={index === 0}
                                        className="text-muted-foreground hover:text-foreground cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={t("moveUp")}
                                      >
                                        <ArrowUp className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveRecommended(index, 1)}
                                        disabled={index === recommended.length - 1}
                                        className="text-muted-foreground hover:text-foreground cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label={t("moveDown")}
                                      >
                                        <ArrowDown className="size-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeRecommended(q.id)}
                                        className="text-muted-foreground hover:text-destructive ml-1 cursor-pointer"
                                        aria-label={t("remove")}
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    </div>
                                  ) : null}
                                </div>

                                <div>
                                  <p className="text-muted-foreground text-xs font-medium">
                                    {t("questionLabel")}
                                  </p>
                                  <p className="text-foreground text-sm">
                                    {q.questionText}
                                  </p>
                                </div>

                                {q.indicator ? (
                                  <div>
                                    <p className="text-muted-foreground text-xs font-medium">
                                      {t("indicatorLabel")}
                                    </p>
                                    <p className="text-foreground text-sm">
                                      <span className="font-medium">
                                        {q.questionCode}
                                      </span>{" "}
                                      · {q.indicator}
                                    </p>
                                  </div>
                                ) : null}

                                <div>
                                  <p className="text-muted-foreground text-xs font-medium">
                                    {t("answerTypeLabel")}
                                  </p>
                                  <Badge variant="outline" className="mt-0.5">
                                    {titleCase(q.answerType)}
                                  </Badge>
                                </div>

                                {q.answerOptions && q.answerOptions.length > 0 ? (
                                  <div>
                                    <p className="text-muted-foreground text-xs font-medium">
                                      {t("optionsLabel")}
                                    </p>
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {q.answerOptions.map((option) => (
                                        <Badge
                                          key={option}
                                          variant="secondary"
                                          className="font-normal"
                                        >
                                          {option}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-sm">
                                  <Checkbox
                                    checked={q.isRequired}
                                    disabled={!isEditable}
                                    onCheckedChange={() =>
                                      toggleRecommendedRequired(q.id)
                                    }
                                  />
                                  {t("requiredLabel")}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-foreground text-sm font-semibold">
                        {t("additionalHeading")}
                      </h2>
                      {isEditable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={openAddModal}
                          className="gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          {t("addOpenEndedQuestion")}
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {t("additionalDescription")}
                    </p>

                    {additional.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {t("noAdditionalQuestions")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {additional.map((q, index) => (
                          <div
                            key={q.id}
                            className="border-border space-y-2.5 rounded-lg border p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-foreground text-sm font-semibold">
                                {t("questionNumber", {
                                  number: recommended.length + index + 1,
                                })}
                              </p>
                              {isEditable ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(q)}
                                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                                    aria-label={t("edit")}
                                  >
                                    <Pencil className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeAdditional(q.id)}
                                    className="text-muted-foreground hover:text-destructive ml-1 cursor-pointer"
                                    aria-label={t("remove")}
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div>
                              <p className="text-muted-foreground text-xs font-medium">
                                {t("questionLabel")}
                              </p>
                              <p className="text-foreground text-sm">{q.questionText}</p>
                            </div>

                            <div>
                              <p className="text-muted-foreground text-xs font-medium">
                                {t("answerTypeLabel")}
                              </p>
                              <Badge variant="outline" className="mt-0.5">
                                {titleCase(q.answerType)}
                              </Badge>
                            </div>

                            {q.answerOptions && q.answerOptions.length > 0 ? (
                              <div>
                                <p className="text-muted-foreground text-xs font-medium">
                                  {t("optionsLabel")}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {q.answerOptions.map((option) => (
                                    <Badge
                                      key={option}
                                      variant="secondary"
                                      className="font-normal"
                                    >
                                      {option}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-sm">
                              <Checkbox checked={q.isRequired} disabled />
                              {t("requiredLabel")}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? t("editOpenEndedQuestion") : t("addOpenEndedQuestion")}
              </DialogTitle>
              <DialogDescription>{t("openEndedDialogDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="open-ended-question">
                  {t("questionLabel")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="open-ended-question"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder={t("openEndedPlaceholder")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="open-ended-answer-type">
                  {t("answerTypeLabel")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={draftAnswerType}
                  onValueChange={(v) =>
                    setDraftAnswerType(v as AdditionalQuestionAnswerType)
                  }
                >
                  <SelectTrigger id="open-ended-answer-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDITIONAL_QUESTION_ANSWER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {titleCase(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {needsOptionsEditor ? (
                <div className="space-y-1.5">
                  <Label>{t("optionsLabel")}</Label>
                  <div className="space-y-2">
                    {draftOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => updateDraftOption(index, e.target.value)}
                          placeholder={t("optionPlaceholder", { number: index + 1 })}
                        />
                        {draftOptions.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => removeDraftOption(index)}
                            className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                            aria-label={t("remove")}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addDraftOption}
                      className="gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      {t("addOption")}
                    </Button>
                  </div>
                </div>
              ) : null}

              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={draftRequired}
                  onCheckedChange={(v) => setDraftRequired(v === true)}
                />
                {t("requiredLabel")}
              </label>

              {modalError ? (
                <p className="text-destructive text-sm">{modalError}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="button" onClick={saveModalQuestion}>
                {editingId ? t("saveQuestion") : t("addQuestion")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
