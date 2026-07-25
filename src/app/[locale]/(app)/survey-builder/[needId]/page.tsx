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
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { LoadingButton } from "@/components/common/loading-button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { cn, formatDomainSummary, titleCase } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { aiReviewService } from "@/services/ai-decisions/ai-decisions.service";
import { domainsService } from "@/services/domains/domains.service";
import { methodologyConfigService } from "@/services/methodology-config/methodology-config.service";
import type { MethodologyVersionOption } from "@/services/methodology-config/methodology-config.types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import {
  surveysService,
  type Question,
  type ReusableCustomQuestion,
  type SaveSurveyQuestionInput,
  type Survey,
  type SurveyQuestionItem,
} from "@/services/surveys/surveys.service";
import {
  CustomQuestionEditorDialog,
  type CustomQuestionValue,
} from "@/components/features/studies/custom-question-editor-dialog";

const STATUS_BADGE_CLASS: Record<Survey["status"], string | undefined> = {
  DRAFT: undefined,
  SUBMITTED: "bg-badge-warning text-badge-warning-foreground border-transparent",
  REJECTED: "bg-destructive/10 text-destructive border-transparent",
  PUBLISHED: "bg-badge-success text-badge-success-foreground border-transparent",
};

const LIST_PREVIEW_COUNT = 5;

let tempIdCounter = 0;
function nextTempId(prefix: string): string {
  tempIdCounter += 1;
  return `${prefix}-${tempIdCounter}`;
}

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
  const [reusableQuestions, setReusableQuestions] = useState<ReusableCustomQuestion[]>(
    [],
  );
  const [loaded, setLoaded] = useState(false);

  // Both the Recommended and Question Bank lists can run into the hundreds
  // (e.g. an allDomainsSelected Need matches every active Question Bank
  // entry) — show a handful up front and let the Approver/Researcher expand
  // into a scrollable list instead of dumping everything onto the page.
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const [showAllEligible, setShowAllEligible] = useState(false);

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
  // Approve/Reject a survey the Researcher already explicitly submitted
  // (Survey.status === SUBMITTED) — a plain decision on exactly what was
  // submitted, no editing (the backend's assertEditable blocks
  // updateQuestions/setMethodologyVersion while SUBMITTED, same as it
  // always has). Separate from saveAndPublish below, which curates + decides
  // + publishes in one action but only applies while the Survey is still
  // DRAFT (need.status === "ai_classified").
  const [approvingSubmitted, setApprovingSubmitted] = useState(false);

  // Reject — either the classification decision itself
  // (aiReviewService.reject, while still ai_classified/DRAFT) or the
  // submitted Survey's content (surveysService.rejectSurvey, once
  // SUBMITTED) — confirmReject below picks whichever applies. One dialog
  // covers both since they're mutually exclusive states.
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comments, setComments] = useState("");
  const [commentsError, setCommentsError] = useState<string | null>(null);

  // TEMPORARY — see MethodologyVersionOption's doc comment. Mandatory
  // before Submit for Approval; the Researcher picks it here, the Approver
  // only ever reviews/publishes whatever was chosen (see the Review page).
  const [methodologyOptions, setMethodologyOptions] = useState<
    MethodologyVersionOption[]
  >([]);
  const [savingMethodologyVersion, setSavingMethodologyVersion] = useState(false);

  // The Researcher only edits/saves/submits from DRAFT or REJECTED — once
  // SUBMITTED, content is frozen for the Researcher; once PUBLISHED, it's
  // frozen for good. Governs the Researcher-only action row (Save Draft/
  // Submit for Approval) and the Methodology Version picker, which the
  // Approver never touches (see setMethodologyVersion on the backend —
  // still unconditionally locked once SUBMITTED for everyone).
  const isEditable =
    canWrite && (survey?.status === "DRAFT" || survey?.status === "REJECTED");
  // The Approver curates the question list (add/remove/reorder, add
  // custom) while reviewing a SUBMITTED survey too — approveSubmittedSurvey
  // below saves whatever's in `recommended`/`additional` before publishing.
  // The backend's updateQuestions now allows this for anyone except the
  // Research Officer (see SurveysService.assertEditable's allowWhileSubmitted
  // param) — same role split as overrideDomainPreview.
  const canEditQuestions = isEditable || (canApprove && survey?.status === "SUBMITTED");

  // Additional Question modal — add or edit one question at a time,
  // instead of the page growing with an ever-longer inline editable list.
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitialValue, setEditingInitialValue] =
    useState<CustomQuestionValue | null>(null);
  // Bumped every time the modal opens so CustomQuestionEditorDialog remounts
  // fresh instead of needing an internal effect to reset its draft state.
  const [modalKey, setModalKey] = useState(0);

  // Manual classification entry path — only rendered when the Need is
  // ai_classification_failed (see the render below). A pure gate in front
  // of the rest of this page: once submitted, `load()` re-fetches the Need
  // (now reviewer_approved, with domain/subDomain set — see
  // AiDecisionsService.manualClassify on the backend) and everything below
  // renders exactly as it already does for an AI-classified Need. No
  // separate Question Bank/Survey Builder logic duplicated here.
  const [domainOptions, setDomainOptions] = useState<
    Array<{ name: string; subDomains: string[] }>
  >([]);
  const [manualDomain, setManualDomain] = useState<string | null>(null);
  const [manualSubDomain, setManualSubDomain] = useState<string | null>(null);
  const [manualClassifying, setManualClassifying] = useState(false);
  const subDomainOptionsFor = (domain: string | null): string[] =>
    domainOptions.find((d) => d.name === domain)?.subDomains ?? [];

  function loadDraftFromSurvey(s: Survey | null) {
    setRecommended((s?.questions ?? []).filter((q) => !q.isCustom));
    setAdditional((s?.questions ?? []).filter((q) => q.isCustom));
    setDirty(false);
  }

  // The Question Bank browse tab's source pairs — which field is
  // authoritative depends on what stage the Need is at, not one fixed
  // fallback chain:
  //  - ai_classified (pending decision): a staged-but-not-yet-approved
  //    Override (need.proposedDomains) is the live signal — read it
  //    directly rather than inferring it through the Survey's regenerated
  //    bank-linked questions, which are legitimately empty when the
  //    newly-chosen sub-domain has zero Question Bank matches (that empty
  //    case used to silently fall back to the OLD, pre-override domain).
  //    No staged Override falls back to allDomainsSelected, then the AI's
  //    own single suggested pair.
  //  - reviewer_approved and everything downstream (survey_created,
  //    survey_published): the domain is final and proposedDomains is
  //    already cleared (see AiDecisionsService.review) — needDomains is
  //    the only thing that matters, falling back to allDomainsSelected.
  //  - anything earlier (draft, pending_ai_classification,
  //    evidence_submitted, ai_classification_failed): no Survey/Question
  //    Bank tab exists yet.
  function questionBankPairsFor(
    needResult: Need,
  ): Array<{ domain: string; subDomain: string }> | null {
    switch (needResult.status) {
      case "ai_classified":
        if (needResult.proposedDomains && needResult.proposedDomains.length > 0) {
          return needResult.proposedDomains;
        }
        if (needResult.allDomainsSelected) return [];
        if (needResult.aiSuggestedDomain && needResult.aiSuggestedSubDomain) {
          return [
            {
              domain: needResult.aiSuggestedDomain,
              subDomain: needResult.aiSuggestedSubDomain,
            },
          ];
        }
        return null;

      case "reviewer_approved":
      case "survey_created":
      case "survey_published":
        if (needResult.needDomains.length > 0) {
          return needResult.needDomains.map((d) => ({
            domain: d.domain,
            subDomain: d.subDomain,
          }));
        }
        if (needResult.allDomainsSelected) return [];
        return null;

      default:
        return null;
    }
  }

  function load() {
    Promise.all([needsService.getById(needId), surveysService.getSurveyByNeedId(needId)])
      .then(([needResult, surveyResult]) => {
        setNeed(needResult);
        setSurvey(surveyResult);
        loadDraftFromSurvey(surveyResult);
        const pairs = questionBankPairsFor(needResult);
        // TEMP diagnostic logging (RIO-debug: research-officer override ->
        // Question Bank tab not showing new sub-domain's questions) — remove
        // once root cause is confirmed.
        console.debug("[QB-DEBUG] survey-builder load()", {
          needId,
          needStatus: needResult.status,
          needDomains: needResult.needDomains,
          surveyQuestionsBankPairs: (surveyResult?.questions ?? [])
            .filter((q) => !q.isCustom)
            .map((q) => ({ domain: q.domain, subDomain: q.subDomain })),
          questionBankPairsForResult: pairs,
        });
        if (pairs !== null) {
          surveysService
            .getQuestions(pairs)
            .then((questions) => {
              console.debug("[QB-DEBUG] survey-builder getQuestions() returned", {
                pairs,
                count: questions.length,
              });
              setEligibleQuestions(questions);
            })
            .catch(() => setEligibleQuestions([]));
        }
        if (pairs && pairs.length > 0) {
          Promise.all(
            pairs.map((p) =>
              surveysService
                .getReusableCustomQuestions(p.domain, p.subDomain)
                .catch(() => []),
            ),
          ).then((lists) => {
            const seen = new Set<string>();
            const merged = lists.flat().filter((q) => {
              if (seen.has(q.id)) return false;
              seen.add(q.id);
              return true;
            });
            setReusableQuestions(merged);
          });
        } else {
          setReusableQuestions([]);
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

  // Auto-select the currently published Methodology Version (the only
  // option this list ever contains now — see
  // MethodologyConfigService.listVersionOptions) the first time a Survey
  // with none chosen yet sees it load, rather than leaving the placeholder
  // for the Researcher to notice and pick manually. If nothing is published
  // (still `draft`), methodologyOptions is empty and the placeholder stays,
  // same as before. Guarded to fire at most once per Survey — without this,
  // a re-render after the auto-save completes (survey.methodologyVersion now
  // set) would just be a no-op anyway, but the guard makes that explicit
  // rather than relying on it.
  const autoSelectedMethodologyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!survey || !isEditable) return;
    if (survey.methodologyVersion) return;
    if (autoSelectedMethodologyRef.current === survey.id) return;
    const published = methodologyOptions[0];
    if (!published) return;
    autoSelectedMethodologyRef.current = survey.id;
    changeMethodologyVersion(published.version);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey, isEditable, methodologyOptions]);

  // Same fetch-once, filter-active pattern AiClassificationSection's own
  // Override-Domain dialog already uses — only actually rendered when the
  // manual-classification gate below is shown, but cheap enough to just
  // always fetch on mount rather than conditioning it on `need.status`.
  useEffect(() => {
    domainsService
      .listWithSubDomains()
      .then((domains) =>
        setDomainOptions(
          domains
            .filter((d) => d.isActive)
            .map((d) => ({
              name: d.name,
              subDomains: d.subDomains.filter((sd) => sd.isActive).map((sd) => sd.name),
            })),
        ),
      )
      .catch(() => setDomainOptions([]));
  }, []);

  async function submitManualClassification() {
    if (!manualDomain || !manualSubDomain) return;
    setManualClassifying(true);
    setError(null);
    try {
      await aiReviewService.manualClassify(needId, manualDomain, manualSubDomain);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setManualClassifying(false);
    }
  }

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
        domain: question.domain,
        subDomain: question.subDomain,
        indicator: question.indicator ?? null,
        kpi: question.kpi ?? null,
        isCustom: false,
        order: prev.length + 1,
        isRequired: question.requiredOptional === "required",
      },
    ]);
    setDirty(true);
  }

  // Copies a reusable custom question's text/type/options into a brand-new
  // SurveyQuestion on THIS survey — not linked by reference the way a
  // Question Bank item is (there's no shared row to link to), so editing it
  // afterward here never affects the original it was copied from.
  function addFromReusable(item: ReusableCustomQuestion) {
    setAdditional((prev) => [
      ...prev,
      {
        id: nextTempId("reused"),
        bankQuestionId: null,
        questionCode: null,
        questionText: item.questionText,
        answerType: item.answerType,
        answerOptions: item.answerOptions,
        domain: item.domain,
        subDomain: item.subDomain,
        indicator: null,
        kpi: item.kpi,
        isCustom: true,
        order: recommended.length + prev.length + 1,
        isRequired: true,
      },
    ]);
    setDirty(true);
  }

  function openAddModal() {
    setEditingId(null);
    setEditingInitialValue(null);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }

  function openEditModal(item: SurveyQuestionItem) {
    setEditingId(item.id);
    setModalKey((k) => k + 1);
    setEditingInitialValue({
      questionText: item.questionText,
      answerType: (item.answerType as CustomQuestionValue["answerType"]) || "long_text",
      answerOptions: item.answerOptions,
      // A legacy custom question saved before Domain/Sub-domain/KPI were
      // captured opens with these blank — the dialog requires them to be
      // filled in before its own Save, same as a brand new question (see
      // CustomQuestionEditorDialog), but nothing here forces that just from
      // opening this page or saving the survey's other questions.
      domain: item.domain,
      subDomain: item.subDomain,
      kpi: item.kpi,
      isRequired: item.isRequired,
    });
    setModalOpen(true);
  }

  function saveModalQuestion(value: CustomQuestionValue) {
    setAdditional((prev) => {
      if (editingId) {
        return prev.map((q) =>
          q.id === editingId
            ? {
                ...q,
                questionText: value.questionText,
                answerType: value.answerType,
                answerOptions: value.answerOptions,
                domain: value.domain,
                subDomain: value.subDomain,
                kpi: value.kpi,
                isRequired: value.isRequired,
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
          questionText: value.questionText,
          answerType: value.answerType,
          answerOptions: value.answerOptions,
          domain: value.domain,
          subDomain: value.subDomain,
          indicator: null,
          kpi: value.kpi,
          isCustom: true,
          order: recommended.length + prev.length + 1,
          isRequired: value.isRequired,
        },
      ];
    });
    setDirty(true);
    setEditingId(null);
    setEditingInitialValue(null);
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
          domain: q.domain ?? undefined,
          subDomain: q.subDomain ?? undefined,
          kpi: q.kpi ?? undefined,
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
    // Buttons stay clickable rather than silently disabled — a validation
    // message the user actually sees is more discoverable than a disabled
    // button whose reason only shows on hover.
    if (!survey.methodologyVersion) {
      setError(t("methodologyVersionRequiredNote"));
      return;
    }
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

  // When the same user holds both surveyBuilder write and approve (the
  // Reviewer/Approver role does both — see role-matrix.ts), routing them
  // through Submit for Approval and then over to a separate Review page to
  // approve their own submission is pure friction, not a real handoff.
  // "Approve & Publish" is the one Approver action for everything: commit
  // the classification decision (as-is, or with whatever Domain Override
  // was staged on the Need workspace page — see pending-override-storage.ts),
  // save the current question list, then submit and publish the Survey.
  async function saveAndPublish() {
    if (!survey || !need) return;
    if (!survey.methodologyVersion) {
      setError(t("methodologyVersionRequiredNote"));
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      // The classification decision itself is still exactly one AiDecision
      // review — only meaningful while the Need hasn't been reviewed yet.
      // Once reviewer_approved+ (a second visit here, e.g. after Reject sent
      // it back and it was reclassified+approved again through some other
      // path), this step is a no-op rather than an error.
      if (need.status === "ai_classified") {
        // The staged Override (if any) now lives on the Need itself
        // (proposedDomains/proposedReason) rather than sessionStorage, so
        // it's whatever was actually staged last — by this Approver or by
        // the Researcher who submitted it — regardless of whose session
        // this is. The backend clears both fields once this Approve call
        // consumes them (see AiDecisionsService.review).
        const domainOverride =
          need.proposedDomains && need.proposedDomains.length > 0
            ? { pairs: need.proposedDomains, reason: need.proposedReason ?? undefined }
            : undefined;
        await aiReviewService.approve(needId, { domainOverride });
      }

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
          domain: q.domain ?? undefined,
          subDomain: q.subDomain ?? undefined,
          kpi: q.kpi ?? undefined,
          order: recommended.length + index + 1,
          isRequired: q.isRequired,
        })),
      ];
      const saved = await surveysService.updateQuestions(survey.id, payload);
      const submitted = await surveysService.submitForApproval(saved.id);
      await surveysService.approveAndPublish(submitted.id);
      const [published, updatedNeed] = await Promise.all([
        surveysService.getSurveyByNeedId(needId),
        needsService.getById(needId),
      ]);
      setSurvey(published);
      loadDraftFromSurvey(published);
      setNeed(updatedNeed);
      setMessage(t("publishedMessage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  // Saves whatever the Approver curated (add/remove/reorder/custom — see
  // canEditQuestions above) then publishes. Distinct from saveAndPublish
  // only in that it skips submitForApproval — the Survey is already
  // SUBMITTED (submitForApproval requires DRAFT/REJECTED and would 409).
  // Still has to commit the classification decision itself first, exactly
  // like saveAndPublish does: a Survey can reach SUBMITTED while its Need
  // is still ai_classified (submitForApproval never required the Need to
  // be reviewer_approved first — see SurveysService), so without this the
  // Survey publishes fine but the Need's domain/subDomain/needDomains are
  // never actually written, leaving "Awaiting Approver review" showing
  // forever even after the Survey is done.
  async function approveSubmittedSurvey() {
    if (!survey || !need) return;
    setApprovingSubmitted(true);
    setError(null);
    setMessage(null);
    try {
      if (need.status === "ai_classified") {
        const domainOverride =
          need.proposedDomains && need.proposedDomains.length > 0
            ? { pairs: need.proposedDomains, reason: need.proposedReason ?? undefined }
            : undefined;
        await aiReviewService.approve(needId, { domainOverride });
      }

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
          domain: q.domain ?? undefined,
          subDomain: q.subDomain ?? undefined,
          kpi: q.kpi ?? undefined,
          order: recommended.length + index + 1,
          isRequired: q.isRequired,
        })),
      ];
      await surveysService.updateQuestions(survey.id, payload);
      await surveysService.approveAndPublish(survey.id);
      const [published, updatedNeed] = await Promise.all([
        surveysService.getSurveyByNeedId(needId),
        needsService.getById(needId),
      ]);
      setSurvey(published);
      loadDraftFromSurvey(published);
      setNeed(updatedNeed);
      setMessage(t("publishedMessage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setApprovingSubmitted(false);
    }
  }

  function openRejectDialog() {
    setComments("");
    setCommentsError(null);
    setRejectOpen(true);
  }

  async function confirmReject() {
    const trimmed = comments.trim();
    if (!trimmed) {
      setCommentsError(t("rejectCommentsRequired"));
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      if (survey?.status === "SUBMITTED") {
        // The Survey's content itself is what's being rejected here (it was
        // explicitly submitted) — sends it back to REJECTED so the
        // Researcher can edit and resubmit. The Need's own domain/subDomain
        // decision is untouched.
        await surveysService.rejectSurvey(survey.id, trimmed);
      } else {
        // Rejecting the classification decision itself — the Need resets to
        // pending_ai_classification for a fresh reclassification. The
        // backend clears proposedDomains/proposedReason itself (see
        // AiDecisionsService.review's rejected branch).
        await aiReviewService.reject(needId, trimmed);
      }
      setRejectOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setRejecting(false);
    }
  }

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
                need?.allDomainsSelected
                  ? "All Domains"
                  : need && need.needDomains.length > 0
                    ? formatDomainSummary(
                        need.needDomains.map((d) => `${d.domain} / ${d.subDomain}`),
                      )
                    : need?.domain && need?.subDomain
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
                    {/* isEditable (below) requires DRAFT/REJECTED, so once a
                        Researcher explicitly submits, these are the
                        Approver's decision actions — Approve & Publish here
                        also saves whatever they curated via canEditQuestions
                        above first (see approveSubmittedSurvey). No role
                        holds surveyBuilder:approve without :write (see
                        role-matrix.ts), so canApprove alone already excludes
                        the Research Officer correctly. */}
                    {canApprove && survey.status === "SUBMITTED" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive gap-1.5"
                          onClick={openRejectDialog}
                          disabled={approvingSubmitted}
                        >
                          <XCircle className="size-3.5" />
                          {t("reject")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={approveSubmittedSurvey}
                          disabled={approvingSubmitted}
                        >
                          {approvingSubmitted ? t("publishing") : t("saveAndPublish")}
                        </Button>
                      </>
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
                    {isEditable && canApprove ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive gap-1.5"
                          onClick={openRejectDialog}
                          disabled={submitting}
                        >
                          <XCircle className="size-3.5" />
                          {t("reject")}
                        </Button>
                        <Button size="sm" onClick={saveAndPublish} disabled={submitting}>
                          {submitting ? t("publishing") : t("saveAndPublish")}
                        </Button>
                      </>
                    ) : isEditable ? (
                      <Button
                        size="sm"
                        onClick={submitForApproval}
                        disabled={submitting || dirty}
                        title={dirty ? t("saveBeforeSubmit") : undefined}
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
                  {canApprove ? t("submittedNoticeApprover") : t("submittedNotice")}
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

            {need?.status === "ai_classification_failed" ? (
              // Manual-classification gate — AI could not classify this
              // Need, so the Researcher picks Domain/Sub-domain here
              // instead. Purely a gate: everything below (Question Bank,
              // custom questions, Save/Submit) is the exact same UI an
              // AI-classified Need already uses, unlocked only once this
              // submits successfully and `load()` re-fetches the Need at
              // reviewer_approved with domain/subDomain set.
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-foreground text-sm font-semibold">
                      {t("manualClassificationTitle")}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("manualClassificationDescription")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("manualClassificationDomainLabel")}</Label>
                    <Select
                      value={manualDomain ?? undefined}
                      onValueChange={(v) => {
                        setManualDomain(v);
                        setManualSubDomain(null);
                      }}
                      disabled={!canWrite || manualClassifying}
                    >
                      <SelectTrigger className="w-full sm:w-96">
                        <SelectValue
                          placeholder={t("manualClassificationSelectDomain")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {domainOptions.map((d) => (
                          <SelectItem key={d.name} value={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("manualClassificationSubDomainLabel")}</Label>
                    <Select
                      value={manualSubDomain ?? undefined}
                      onValueChange={setManualSubDomain}
                      disabled={!canWrite || !manualDomain || manualClassifying}
                    >
                      <SelectTrigger className="w-full sm:w-96">
                        <SelectValue
                          placeholder={t("manualClassificationSelectSubDomain")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {subDomainOptionsFor(manualDomain).map((sd) => (
                          <SelectItem key={sd} value={sd}>
                            {sd}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {canWrite ? (
                    <Button
                      size="sm"
                      onClick={submitManualClassification}
                      disabled={!manualDomain || !manualSubDomain || manualClassifying}
                      className="gap-1.5"
                    >
                      {manualClassifying ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      {manualClassifying
                        ? t("manualClassificationSubmitting")
                        : t("manualClassificationSubmit")}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : !survey ? (
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
                    <p
                      className={cn(
                        "text-xs",
                        isEditable && !survey.methodologyVersion
                          ? "text-warning font-medium"
                          : "text-muted-foreground",
                      )}
                    >
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
                          <TabsTrigger value="customQuestions" size="lg">
                            {t("customQuestionsTab")}
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="customQuestions" className="mt-6 space-y-4">
                        {/* Custom questions previously typed in from scratch
                            on some OTHER survey, for this exact Domain/
                            Sub-domain — reuse instead of retype. Deliberately
                            NOT every custom question ever created (see
                            SurveysService.listReusableCustomQuestions). */}
                        <p className="text-muted-foreground text-xs">
                          {t("customQuestionsDescription")}
                        </p>
                        {reusableQuestions.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            {t("customQuestionsEmpty")}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {reusableQuestions.map((q) => {
                              const added = additional.some(
                                (item) =>
                                  item.questionText.trim().toLowerCase() ===
                                  q.questionText.trim().toLowerCase(),
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
                                    {canEditQuestions ? (
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant={added ? "secondary" : "outline"}
                                        className={cn(
                                          "size-8 shrink-0",
                                          added &&
                                            "bg-badge-success text-badge-success-foreground hover:bg-badge-success",
                                        )}
                                        disabled={added}
                                        onClick={() => addFromReusable(q)}
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

                                  <p className="text-muted-foreground text-xs">
                                    {t("customQuestionsSourceLabel", {
                                      survey: q.sourceSurveyTitle,
                                    })}
                                  </p>

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

                      <TabsContent value="questionBank" className="mt-6 space-y-4">
                        {/* Every Question Bank row matching this Need's
                            classification — the same `eligibleQuestions` the
                            combobox draws from, browsable in full rather than
                            one search-and-select at a time. Available before
                            Approval too (using the AI's own suggested pair,
                            or "every active question" when
                            allDomainsSelected), not gated on the Approved
                            domain/subDomain fields the way it used to be. */}
                        <p className="text-muted-foreground text-xs">
                          {need?.allDomainsSelected
                            ? t("questionBankDescriptionAllDomains")
                            : need && need.needDomains.length > 0
                              ? t("questionBankDescription", {
                                  scope: formatDomainSummary(
                                    need.needDomains.map(
                                      (d) => `${d.domain} / ${d.subDomain}`,
                                    ),
                                  ),
                                })
                              : need?.domain && need?.subDomain
                                ? t("questionBankDescription", {
                                    scope: `${need.domain} / ${need.subDomain}`,
                                  })
                                : need?.aiSuggestedDomain && need?.aiSuggestedSubDomain
                                  ? t("questionBankDescriptionSuggested", {
                                      scope: `${need.aiSuggestedDomain} / ${need.aiSuggestedSubDomain}`,
                                    })
                                  : t("questionBankNoDomain")}
                        </p>

                        {eligibleQuestions.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            {t("questionBankEmpty")}
                          </p>
                        ) : (
                          <div
                            className={cn(
                              "space-y-3",
                              showAllEligible &&
                                eligibleQuestions.length > LIST_PREVIEW_COUNT &&
                                "max-h-[36rem] overflow-y-auto pr-1",
                            )}
                          >
                            {(showAllEligible
                              ? eligibleQuestions
                              : eligibleQuestions.slice(0, LIST_PREVIEW_COUNT)
                            ).map((q) => {
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
                                    {canEditQuestions ? (
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
                        {eligibleQuestions.length > LIST_PREVIEW_COUNT ? (
                          <div className="flex justify-center pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => setShowAllEligible((v) => !v)}
                            >
                              {showAllEligible
                                ? t("showLess")
                                : t("showMore", {
                                    count: eligibleQuestions.length - LIST_PREVIEW_COUNT,
                                  })}
                            </Button>
                          </div>
                        ) : null}
                      </TabsContent>

                      <TabsContent value="recommended" className="mt-6 space-y-4">
                        {recommended.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            {t("noRecommendedQuestions")}
                          </p>
                        ) : (
                          <div
                            className={cn(
                              "space-y-3",
                              showAllRecommended &&
                                recommended.length > LIST_PREVIEW_COUNT &&
                                "max-h-[36rem] overflow-y-auto pr-1",
                            )}
                          >
                            {/* Preserve each question's true position
                                (needed by move up/down and remove, which act
                                on `recommended` itself) even when the visible
                                list is truncated to a preview slice. */}
                            {(showAllRecommended
                              ? recommended.map((q, index) => ({ q, index }))
                              : recommended
                                  .map((q, index) => ({ q, index }))
                                  .slice(0, LIST_PREVIEW_COUNT)
                            ).map(({ q, index }) => (
                              <div
                                key={q.id}
                                className="border-border space-y-2.5 rounded-lg border p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-foreground text-sm font-semibold">
                                    {t("questionNumber", { number: index + 1 })}
                                  </p>
                                  {canEditQuestions ? (
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
                                    disabled={!canEditQuestions}
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
                        {recommended.length > LIST_PREVIEW_COUNT ? (
                          <div className="flex justify-center pt-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => setShowAllRecommended((v) => !v)}
                            >
                              {showAllRecommended
                                ? t("showLess")
                                : t("showMore", {
                                    count: recommended.length - LIST_PREVIEW_COUNT,
                                  })}
                            </Button>
                          </div>
                        ) : null}
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
                      {canEditQuestions ? (
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
                              {canEditQuestions ? (
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

        <CustomQuestionEditorDialog
          key={modalKey}
          open={modalOpen}
          onOpenChange={setModalOpen}
          initialValue={editingInitialValue}
          onSave={saveModalQuestion}
        />

        <Dialog
          open={rejectOpen}
          onOpenChange={(open) => !rejecting && setRejectOpen(open)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {survey?.status === "SUBMITTED"
                  ? t("rejectSurveyDialogTitle")
                  : t("rejectDialogTitle")}
              </DialogTitle>
              <DialogDescription>
                {survey?.status === "SUBMITTED"
                  ? t("rejectSurveyDialogDescription")
                  : t("rejectDialogDescription")}
              </DialogDescription>
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
                placeholder={t("rejectCommentsPlaceholder")}
                aria-invalid={commentsError ? true : undefined}
              />
              {commentsError ? (
                <p className="text-destructive text-sm">{commentsError}</p>
              ) : null}
            </div>
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
