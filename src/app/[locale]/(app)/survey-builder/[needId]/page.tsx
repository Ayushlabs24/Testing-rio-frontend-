"use client";

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
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
import { usePermission } from "@/hooks/use-permission";
import { Link } from "@/i18n/navigation";
import { titleCase } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { methodologyConfigService } from "@/services/methodology-config/methodology-config.service";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import {
  surveysService,
  type Question,
  type SaveSurveyQuestionInput,
  type Survey,
  type SurveyQuestionItem,
} from "@/services/surveys/surveys.service";

let tempIdCounter = 0;
function nextTempId(prefix: string): string {
  tempIdCounter += 1;
  return `${prefix}-${tempIdCounter}`;
}

// Open-ended (Additional) questions are qualitative by design — excluded
// from Priority Scoring, feeding AI Summary instead — so there's no need
// for structured answer types here. Long Text is the only option; this used
// to also offer multiple_choice/checkbox/yes_no/rating, which added a whole
// options-editor UI for a question type that was never actually scored.
const OPEN_ENDED_ANSWER_TYPE = "long_text";

export default function SurveyBuilderDetailPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.surveyBuilder.detail");
  const canWrite = usePermission("surveyBuilder", "write");

  const [need, setNeed] = useState<Need | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [eligibleQuestions, setEligibleQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);
  // The currently active Methodology Version — read-only here (Settings >
  // Methodology is the only place it's edited). Shown before publish so a
  // Research Officer knows what will be stamped onto the Survey; once
  // published, `survey.methodologyVersion` (a frozen snapshot) is shown
  // instead, since that's what the Survey actually recorded.
  const [activeMethodologyVersion, setActiveMethodologyVersion] = useState<string | null>(null);

  // Draft — the two sections editable locally, only persisted on Save. Kept
  // apart (rather than one array) since the UI, save-validation, and
  // add/remove behavior genuinely differ per kind.
  const [recommended, setRecommended] = useState<SurveyQuestionItem[]>([]);
  const [additional, setAdditional] = useState<SurveyQuestionItem[]>([]);
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Additional Question modal — add or edit one question at a time,
  // instead of the page growing with an ever-longer inline editable list.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftRequired, setDraftRequired] = useState(true);
  const [modalError, setModalError] = useState<string | null>(null);

  function loadDraftFromSurvey(s: Survey | null) {
    setRecommended((s?.questions ?? []).filter((q) => !q.isCustom));
    setAdditional((s?.questions ?? []).filter((q) => q.isCustom));
    setDirty(false);
  }

  function load() {
    Promise.all([
      needsService.getById(needId),
      surveysService.getSurveyByNeedId(needId),
    ])
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
      .get()
      .then((config) => setActiveMethodologyVersion(config.version))
      .catch(() => undefined);
  }, []);

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

    setAdditional((prev) => {
      if (editingId) {
        return prev.map((q) =>
          q.id === editingId
            ? {
                ...q,
                questionText: text,
                answerType: OPEN_ENDED_ANSWER_TYPE,
                answerOptions: null,
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
          answerType: OPEN_ENDED_ANSWER_TYPE,
          answerOptions: null,
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

  async function publish() {
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

  const availableToAdd = eligibleQuestions.filter(
    (q) => !recommended.some((included) => included.bankQuestionId === q.id),
  );

  return (
    <PermissionGuard module="surveyBuilder" action="read">
      <PageContainer>
        <Link
          href="/survey-builder"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToList")}
        </Link>

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
                survey && canWrite ? (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={survey.status === "DRAFT" ? "outline" : "default"}
                      className={
                        survey.status !== "DRAFT"
                          ? "bg-badge-success text-badge-success-foreground border-transparent"
                          : undefined
                      }
                    >
                      {survey.status}
                    </Badge>
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
                    {survey.status === "DRAFT" ? (
                      <Button
                        size="sm"
                        onClick={publish}
                        disabled={publishing || dirty}
                        title={dirty ? t("saveBeforePublish") : undefined}
                      >
                        {publishing ? t("publishing") : t("publish")}
                      </Button>
                    ) : null}
                  </div>
                ) : null
              }
            />

            {survey ? (
              <div className="mb-4 flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t("methodologyVersionLabel")}</span>
                <Badge variant="outline">
                  {survey.methodologyVersion ?? activeMethodologyVersion ?? "—"}
                </Badge>
                {!survey.methodologyVersion ? (
                  <span className="text-muted-foreground">{t("methodologyVersionPendingNote")}</span>
                ) : null}
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
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-foreground text-sm font-semibold">
                      {t("recommendedHeading")}
                    </h2>

                    {canWrite ? (
                      <div className="space-y-2">
                        <label className="text-muted-foreground text-xs font-medium">
                          {t("addQuestionLabel")}
                        </label>
                        <Combobox
                          items={availableToAdd.map((q) => ({
                            value: q.id,
                            label: q.questionText,
                          }))}
                          value={null}
                          onSelect={addFromQuestionBank}
                          placeholder={t("addQuestionPlaceholder")}
                          searchPlaceholder={t("addQuestionPlaceholder")}
                          emptyText={t("noEligibleQuestions")}
                          aria-label={t("addQuestionLabel")}
                        />
                      </div>
                    ) : null}

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
                              {canWrite ? (
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
                              <p className="text-foreground text-sm">{q.questionText}</p>
                            </div>

                            {q.indicator ? (
                              <div>
                                <p className="text-muted-foreground text-xs font-medium">
                                  {t("indicatorLabel")}
                                </p>
                                <p className="text-foreground text-sm">
                                  <span className="font-medium">{q.questionCode}</span> ·{" "}
                                  {q.indicator}
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
                                disabled={!canWrite}
                                onCheckedChange={() => toggleRecommendedRequired(q.id)}
                              />
                              {t("requiredLabel")}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-foreground text-sm font-semibold">
                        {t("additionalHeading")}
                      </h2>
                      {canWrite ? (
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
                              {canWrite ? (
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
