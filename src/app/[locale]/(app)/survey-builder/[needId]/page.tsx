"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
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
import { Combobox } from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { Link } from "@/i18n/navigation";
import { cn, formatDomainSummary, titleCase } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { aiReviewService } from "@/services/ai-decisions/ai-decisions.service";
import { domainsService } from "@/services/domains/domains.service";
import { methodologyConfigService } from "@/services/methodology-config/methodology-config.service";
import type { MethodologyVersionOption } from "@/services/methodology-config/methodology-config.types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import {
  REJECTION_REASON_LABELS,
  surveysService,
  type Question,
  type RejectionReasonCode,
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
  // Client-confirmed (Aug 13 call): a distinct "approved, not yet live"
  // state — the Researcher still has to Publish it themselves. Reuses the
  // `primary` badge token (no dedicated "info" token exists in this design
  // system) to stay visually distinct from SUBMITTED (warning) and
  // PUBLISHED (success).
  APPROVED: "bg-badge-primary text-badge-primary-foreground border-transparent",
  REJECTED: "bg-destructive/10 text-destructive border-transparent",
  PUBLISHED: "bg-badge-success text-badge-success-foreground border-transparent",
  SUPERSEDED: "bg-muted text-muted-foreground border-transparent",
};

const LIST_PREVIEW_COUNT = 5;

let tempIdCounter = 0;
function nextTempId(prefix: string): string {
  tempIdCounter += 1;
  return `${prefix}-${tempIdCounter}`;
}
// Every newly-added (not-yet-saved) question gets one of these client-side
// temp ids — never a real SurveyQuestion UUID, so never sent as `id` in the
// save payload (see buildQuestionsPayload below).
function isTempQuestionId(id: string): boolean {
  return id.startsWith("bank-") || id.startsWith("custom-");
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
  // Bug fix (Aug 13): Publish and Create New Version were gated on `write`,
  // which Human Reviewer also holds (restored the same day, for curating
  // questions mid-review — unrelated to publishing). `create` is the
  // precise gate for "actually owns the post-approval/post-publish
  // lifecycle" — every role that should reach these (Researcher, Field
  // Researcher, NGO Admin, System Admin) holds it, and Human Reviewer,
  // uniquely, doesn't.
  const canPublish = usePermission("surveyBuilder", "create");

  const [need, setNeed] = useState<Need | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [eligibleQuestions, setEligibleQuestions] = useState<Question[]>([]);
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
  // Client-confirmed (Aug 13 call): Publish is now the Researcher's own,
  // separate action from Approve — see publishSurveyNow.
  const [publishing, setPublishing] = useState(false);
  const [creatingNewVersion, setCreatingNewVersion] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A fixed-position toast, not an inline banner buried below the page
  // header — Save Draft (and every other action that sets `message`) needs
  // to be noticeable without scrolling, and auto-dismisses on its own.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  // Approve/Reject a survey the Researcher already explicitly submitted
  // (Survey.status === SUBMITTED) — the Approver can still curate questions
  // right up to this decision (see canEditQuestions/approveSubmittedSurvey
  // below), but setMethodologyVersion stays locked for everyone once
  // SUBMITTED. Separate from saveAndApprove below, which curates + decides
  // in one action but only applies while the Survey is still DRAFT
  // (need.status === "ai_classified"). Neither one publishes anymore —
  // that's the Researcher's own separate action (see publishSurveyNow).
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
  // Only meaningful for the surveysService.rejectSurvey branch (SUBMITTED) —
  // the aiReviewService.reject branch has no reason-code concept of its own.
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode | "">("");
  const [reasonCodeError, setReasonCodeError] = useState<string | null>(null);

  // Client-confirmed (Aug 13 call): while the Approver curates questions on
  // a SUBMITTED survey, any removal must carry a reason — prompted right at
  // the moment of removal, not batched at Save time. Free text for now (a
  // fixed set of codes was explicitly deferred on that call). Keyed by the
  // SurveyQuestionItem's own id, carried through to updateQuestions'
  // removalReasons. The Researcher's own DRAFT/REJECTED editing never
  // prompts — see removeRecommended/removeAdditional below.
  const [removalReasons, setRemovalReasons] = useState<Record<string, string>>({});
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: string;
    kind: "recommended" | "additional";
    label: string;
  } | null>(null);
  const [removalReasonInput, setRemovalReasonInput] = useState("");
  const [removalReasonError, setRemovalReasonError] = useState<string | null>(null);

  // Approve & Publish — reviewer notes are mandatory here too (client
  // requirement), so this now goes through its own confirmation dialog
  // instead of firing straight off the button, same "open dialog, validate,
  // confirm" shape as reject above. Loading state is still whichever of
  // submitting/approvingSubmitted already tracks the DRAFT vs SUBMITTED path.
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComments, setApproveComments] = useState("");
  const [approveCommentsError, setApproveCommentsError] = useState<string | null>(null);

  // TEMPORARY — see MethodologyVersionOption's doc comment. Mandatory
  // before Submit for Approval; the Researcher picks it here, the Approver
  // only ever reviews/publishes whatever was chosen (see the Review page).
  const [methodologyOptions, setMethodologyOptions] = useState<
    MethodologyVersionOption[]
  >([]);
  const [savingMethodologyVersion, setSavingMethodologyVersion] = useState(false);

  // Sample Description step — Target Group / Expected Sample Size /
  // Selection Approach / Geographic Coverage, saved together as one Save
  // action (see setSampleDescription). Local editable copies rather than
  // binding straight to `survey` since these are free-text/number inputs,
  // not a single-value Select like Methodology Version above — synced from
  // `survey` whenever it (re)loads, see the effect below.
  const [targetGroup, setTargetGroup] = useState("");
  // The Question Bank's confirmed "who answers this question" vocabulary
  // (METH — Question Bank column J) — reused here as Target Group's options
  // instead of free text, since it's the same underlying concept (who the
  // survey's sample is drawn from). Sourced live, not hardcoded.
  const [targetRespondentOptions, setTargetRespondentOptions] = useState<string[]>([]);
  // RIO-FR-024/RIO-FR-011 clarification (Aug 11, client-confirmed): the
  // Sample Description's Expected Size is a separate value entered by the
  // NGO, deliberately NOT auto-populated from the Study's own calculated
  // Required Sample Size — the two can legitimately diverge (e.g. an NGO
  // targeting a specific sub-group within the calculated sample).
  const [expectedSampleSize, setExpectedSampleSize] = useState("");
  const [selectionApproach, setSelectionApproach] = useState("");
  const [geographicCoverage, setGeographicCoverage] = useState("");
  const [savingSampleDescription, setSavingSampleDescription] = useState(false);
  const [sampleDescriptionError, setSampleDescriptionError] = useState<string | null>(
    null,
  );

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
    setTargetGroup(s?.targetGroup ?? "");
    setExpectedSampleSize(s?.expectedSampleSize ? String(s.expectedSampleSize) : "");
    setSelectionApproach(s?.selectionApproach ?? "");
    setGeographicCoverage(s?.geographicCoverage ?? "");
    setSampleDescriptionError(null);
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
        if (pairs !== null) {
          surveysService
            .getQuestions(pairs)
            .then((questions) => {
              setEligibleQuestions(questions);
            })
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

  useEffect(() => {
    surveysService
      .getTargetRespondentOptions()
      .then(setTargetRespondentOptions)
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

  async function saveSampleDescription() {
    if (!survey) return;
    const trimmedTargetGroup = targetGroup.trim();
    const trimmedSelectionApproach = selectionApproach.trim();
    const trimmedGeographicCoverage = geographicCoverage.trim();
    const sampleSize = Number(expectedSampleSize);
    if (
      !trimmedTargetGroup ||
      !trimmedSelectionApproach ||
      !trimmedGeographicCoverage ||
      !Number.isInteger(sampleSize) ||
      sampleSize < 1
    ) {
      setSampleDescriptionError(t("sampleDescriptionValidationError"));
      return;
    }
    setSavingSampleDescription(true);
    setSampleDescriptionError(null);
    setError(null);
    try {
      const updated = await surveysService.setSampleDescription(survey.id, {
        targetGroup: trimmedTargetGroup,
        expectedSampleSize: sampleSize,
        selectionApproach: trimmedSelectionApproach,
        geographicCoverage: trimmedGeographicCoverage,
      });
      setSurvey(updated);
      setMessage(t("saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSavingSampleDescription(false);
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
    if (survey?.status === "SUBMITTED") {
      const q = recommended.find((r) => r.id === id);
      setPendingRemoval({ id, kind: "recommended", label: q?.questionText ?? "" });
      setRemovalReasonInput("");
      setRemovalReasonError(null);
      return;
    }
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
        priorityWeight: question.priorityWeight ?? null,
        isCustom: false,
        order: prev.length + 1,
        isRequired: question.requiredOptional === "required",
      },
    ]);
    setDirty(true);
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
    if (survey?.status === "SUBMITTED") {
      const q = additional.find((a) => a.id === id);
      setPendingRemoval({ id, kind: "additional", label: q?.questionText ?? "" });
      setRemovalReasonInput("");
      setRemovalReasonError(null);
      return;
    }
    setAdditional((prev) => prev.filter((q) => q.id !== id));
    setDirty(true);
  }

  function cancelRemoval() {
    setPendingRemoval(null);
    setRemovalReasonInput("");
    setRemovalReasonError(null);
  }

  function confirmRemoval() {
    if (!pendingRemoval) return;
    const trimmed = removalReasonInput.trim();
    if (!trimmed) {
      setRemovalReasonError(t("removalReasonRequired"));
      return;
    }
    const { id, kind } = pendingRemoval;
    if (kind === "recommended") {
      setRecommended((prev) => prev.filter((q) => q.id !== id));
    } else {
      setAdditional((prev) => prev.filter((q) => q.id !== id));
    }
    setRemovalReasons((prev) => ({ ...prev, [id]: trimmed }));
    setDirty(true);
    setPendingRemoval(null);
    setRemovalReasonInput("");
    setRemovalReasonError(null);
  }

  // Shared by every save path (Researcher's own Save, saveAndPublish,
  // approveSubmittedSurvey) — `id` is only carried through for a question
  // that already exists on the backend (not one of this session's own
  // not-yet-saved temp ids), so the backend can tell a genuine removal
  // apart from a brand-new addition (see updateQuestions' removalReasons).
  function buildQuestionsPayload(): SaveSurveyQuestionInput[] {
    return [
      ...recommended.map((q, index) => ({
        ...(isTempQuestionId(q.id) ? {} : { id: q.id }),
        questionId: q.bankQuestionId as string,
        order: index + 1,
        isRequired: q.isRequired,
      })),
      ...additional.map((q, index) => ({
        ...(isTempQuestionId(q.id) ? {} : { id: q.id }),
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
  }

  async function save() {
    if (!survey) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await surveysService.updateQuestions(
        survey.id,
        buildQuestionsPayload(),
      );
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

  // RIO-FR-011: the only way to change a PUBLISHED survey — creates a new
  // DRAFT version (a copy of this one's questions/methodology/sample
  // description) and switches the page over to editing that instead. The
  // published original stays PUBLISHED (or moves to SUPERSEDED once this
  // new version itself gets published) and is never edited in place.
  async function createNewVersion() {
    if (!survey) return;
    setCreatingNewVersion(true);
    setError(null);
    try {
      const updated = await surveysService.createNewVersion(survey.id);
      setSurvey(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setCreatingNewVersion(false);
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
  // Client-confirmed (Aug 13 call): Approve no longer publishes in the same
  // step — it hands the survey to APPROVED, and the Researcher (or anyone
  // else holding surveyBuilder:write) does a separate, deliberate Publish
  // afterwards (see publishSurveyNow below). Renamed from saveAndPublish.
  // The classification decision itself is still exactly one AiDecision
  // review — only meaningful while the Need hasn't been reviewed yet. Once
  // reviewer_approved+ this step is a no-op, not an error. Re-fetches the
  // Need fresh from the server rather than trusting the page's own `need`
  // state: that state can go stale (e.g. the classification was approved
  // earlier — on this same page or elsewhere — without this page
  // re-rendering against it), and calling AiDecisionsService.approve a
  // second time on an already-decided Need throws AI_DECISION_NOT_FOUND
  // ("No AI classification is pending review for this need"), surfacing a
  // confusing error for an approve action that already, genuinely
  // succeeded. AI_DECISION_NOT_FOUND is swallowed here for that reason —
  // every other error still surfaces normally.
  async function resolveClassificationIfPending(): Promise<void> {
    const fresh = await needsService.getById(needId);
    if (fresh.status !== "ai_classified") return;
    // The staged Override (if any) now lives on the Need itself
    // (proposedDomains/proposedReason) rather than sessionStorage, so it's
    // whatever was actually staged last — by this Approver or by the
    // Researcher who submitted it — regardless of whose session this is.
    // The backend clears both fields once this Approve call consumes them
    // (see AiDecisionsService.review).
    // reason is required going forward (see overrideDomainPreview), so
    // proposedReason is only ever missing here for a staged override that
    // predates that requirement — treat it the same as "no staged
    // override" rather than sending a reason-less override.
    const domainOverride =
      fresh.proposedDomains && fresh.proposedDomains.length > 0 && fresh.proposedReason
        ? { pairs: fresh.proposedDomains, reason: fresh.proposedReason }
        : undefined;
    try {
      await aiReviewService.approve(needId, { domainOverride });
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_DECISION_NOT_FOUND") return;
      throw err;
    }
  }

  async function saveAndApprove(comments: string) {
    if (!survey || !need) return;
    if (!survey.methodologyVersion) {
      setError(t("methodologyVersionRequiredNote"));
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await resolveClassificationIfPending();

      const saved = await surveysService.updateQuestions(
        survey.id,
        buildQuestionsPayload(),
      );
      const submitted = await surveysService.submitForApproval(saved.id);
      await surveysService.approveSurvey(submitted.id, comments);
      const [approved, updatedNeed] = await Promise.all([
        surveysService.getSurveyByNeedId(needId),
        needsService.getById(needId),
      ]);
      setSurvey(approved);
      loadDraftFromSurvey(approved);
      setNeed(updatedNeed);
      setMessage(t("approvedMessage"));
      setApproveOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  // Saves whatever the Approver curated (add/remove/reorder/custom, with a
  // reason on any removal — see removeRecommended/removeAdditional above)
  // then approves. Distinct from saveAndApprove only in that it skips
  // submitForApproval — the Survey is already SUBMITTED (submitForApproval
  // requires DRAFT/REJECTED and would 409). Still has to commit the
  // classification decision itself first, exactly like saveAndApprove does:
  // a Survey can reach SUBMITTED while its Need is still ai_classified
  // (submitForApproval never required the Need to be reviewer_approved
  // first — see SurveysService), so without this the Survey gets approved
  // fine but the Need's domain/subDomain/needDomains are never actually
  // written, leaving "Awaiting Approver review" showing forever even after
  // the Survey is done. Client-confirmed (Aug 13 call): no longer
  // auto-publishes — see saveAndApprove's own comment above.
  async function approveSubmittedSurvey(comments: string) {
    if (!survey || !need) return;
    setApprovingSubmitted(true);
    setError(null);
    setMessage(null);
    try {
      await resolveClassificationIfPending();

      await surveysService.updateQuestions(
        survey.id,
        buildQuestionsPayload(),
        removalReasons,
      );
      await surveysService.approveSurvey(survey.id, comments);
      const [approved, updatedNeed] = await Promise.all([
        surveysService.getSurveyByNeedId(needId),
        needsService.getById(needId),
      ]);
      setSurvey(approved);
      loadDraftFromSurvey(approved);
      setNeed(updatedNeed);
      setRemovalReasons({});
      setMessage(t("approvedMessage"));
      setApproveOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setApprovingSubmitted(false);
    }
  }

  // Researcher (or anyone else holding surveyBuilder:write): the actual
  // go-live step, once the Approver has already approved. Client-confirmed
  // (Aug 13 call) — a separate, deliberate action now, not chained
  // automatically off Approve.
  async function publishSurveyNow() {
    if (!survey) return;
    setPublishing(true);
    setError(null);
    setMessage(null);
    try {
      await surveysService.publishSurvey(survey.id);
      const published = await surveysService.getSurveyByNeedId(needId);
      setSurvey(published);
      loadDraftFromSurvey(published);
      setMessage(t("publishedMessage"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setPublishing(false);
    }
  }

  function openApproveDialog() {
    setApproveComments("");
    setApproveCommentsError(null);
    setApproveOpen(true);
  }

  function confirmApprove() {
    const trimmed = approveComments.trim();
    if (!trimmed) {
      setApproveCommentsError(t("approveCommentsRequired"));
      return;
    }
    if (survey?.status === "SUBMITTED") {
      approveSubmittedSurvey(trimmed);
    } else {
      saveAndApprove(trimmed);
    }
  }

  function openRejectDialog() {
    setComments("");
    setCommentsError(null);
    setReasonCode("");
    setReasonCodeError(null);
    setRejectOpen(true);
  }

  async function confirmReject() {
    const trimmed = comments.trim();
    const isSurveyReject = survey?.status === "SUBMITTED";

    if (isSurveyReject && !reasonCode) {
      setReasonCodeError(t("rejectReasonCodeRequired"));
      return;
    }
    // Comments (reviewer notes) are always required now, for both the
    // AI-review-reject branch and every survey-reject reason code — no
    // longer conditional on "Other" being selected.
    if (!trimmed) {
      setCommentsError(t("rejectCommentsRequired"));
      return;
    }

    setRejecting(true);
    setError(null);
    try {
      if (isSurveyReject && survey) {
        // The Survey's content itself is what's being rejected here (it was
        // explicitly submitted) — sends it back to REJECTED so the
        // Researcher can edit and resubmit. The Need's own domain/subDomain
        // decision is untouched.
        await surveysService.rejectSurvey(
          survey.id,
          reasonCode as RejectionReasonCode,
          trimmed,
        );
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
      {message ? (
        <div
          role="status"
          className="border-badge-success bg-badge-success text-badge-success-foreground fixed top-20 right-4 z-[9999] rounded-md border px-4 py-3 text-sm font-medium shadow-lg"
        >
          {message}
        </div>
      ) : null}
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
                    {/* UX fix (Aug 13): the Reviewer previously had to leave
                        this page and manually re-find the Need under
                        Studies just to reach Override Domain (it lives on
                        the Need detail page's AiClassificationSection, not
                        here) — a real navigation gap, not a permission
                        issue. canApprove here doubles as "holds aiReview:
                        approve too" for every role that currently has
                        surveyBuilder:approve at all (Human Reviewer, NGO
                        Admin), so it's a safe proxy without adding a
                        second permission check purely for this link — the
                        destination page still gates the button itself. */}
                    {canApprove && need ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link href={`/studies/${need.studyId}/needs/${needId}`}>
                          <ExternalLink className="size-3.5" />
                          {t("viewNeedClassification")}
                        </Link>
                      </Button>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[survey.status]}
                    >
                      {t(`status.${survey.status}`)}
                    </Badge>
                    {/* isEditable (below) requires DRAFT/REJECTED, so once a
                        Researcher explicitly submits, these are the
                        Approver's decision actions — Approve here also
                        saves whatever they curated via canEditQuestions
                        above first (see approveSubmittedSurvey). Client-
                        confirmed (Aug 13 call): Approve no longer publishes
                        — it moves to APPROVED, and the Researcher publishes
                        separately below. No role holds surveyBuilder:approve
                        without :write (see role-matrix.ts), so canApprove
                        alone already excludes the Research Officer
                        correctly. */}
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
                          onClick={openApproveDialog}
                          disabled={approvingSubmitted}
                        >
                          {approvingSubmitted ? t("approving") : t("approveAction")}
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
                    {isEditable && canApprove && survey.status === "DRAFT" ? (
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
                        <Button
                          size="sm"
                          onClick={openApproveDialog}
                          disabled={submitting}
                        >
                          {submitting ? t("approving") : t("approveAction")}
                        </Button>
                      </>
                    ) : isEditable && !canApprove ? (
                      <Button
                        size="sm"
                        onClick={submitForApproval}
                        disabled={submitting || dirty}
                        title={dirty ? t("saveBeforeSubmit") : undefined}
                      >
                        {submitting ? t("submitting") : t("submitForApproval")}
                      </Button>
                    ) : null}
                    {/* Client-confirmed (Aug 13 call): Publish is the
                        Researcher's own, separate action once a survey is
                        APPROVED — never chained automatically off Approve.
                        canPublish (not canWrite) — see its own comment. */}
                    {canPublish && survey.status === "APPROVED" ? (
                      <Button size="sm" onClick={publishSurveyNow} disabled={publishing}>
                        {publishing ? t("publishing") : t("publishAction")}
                      </Button>
                    ) : null}
                    {/* UX fix (Aug 13): moved out of a banner further down
                        the page into the header actions row, alongside
                        every other survey-lifecycle action. */}
                    {canPublish && survey.status === "PUBLISHED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={createNewVersion}
                        disabled={creatingNewVersion}
                      >
                        {creatingNewVersion
                          ? t("creatingNewVersion")
                          : t("createNewVersion")}
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

            {/* Client-confirmed (Aug 13 call): a distinct APPROVED state —
                the Approver has signed off, but nothing is live until the
                Researcher (or anyone else holding surveyBuilder:create)
                clicks Publish above. canPublish (not canWrite) — Human
                Reviewer holds write (for question curation) but not
                create, so they correctly see "sent to the Researcher"
                rather than a call to action they can't actually take. */}
            {survey?.status === "APPROVED" ? (
              <div
                role="status"
                className="border-badge-primary/40 bg-badge-primary/10 mb-4 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <Check className="text-badge-primary-foreground mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-badge-primary-foreground text-sm">
                    {canPublish ? t("approvedNoticeResearcher") : t("approvedNotice")}
                  </p>
                  {survey.approverComments ? (
                    <p className="text-foreground text-sm whitespace-pre-wrap">
                      {survey.approverComments}
                    </p>
                  ) : null}
                </div>
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

            {survey?.status === "PUBLISHED" && survey.approverComments ? (
              <div
                role="status"
                className="border-border bg-muted/40 mb-4 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <Check className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-foreground text-sm font-medium">
                    {t("reviewerNotesTitle")}
                  </p>
                  <p className="text-foreground text-sm whitespace-pre-wrap">
                    {survey.approverComments}
                  </p>
                </div>
              </div>
            ) : null}

            {/* UX fix (Aug 13): the Create New Version action now lives as
                a button in the header actions row (top-right, alongside
                Publish/Approve/Save) instead of buried in this banner —
                this stays purely informational. canPublish (not canWrite)
                — same Human-Reviewer-exclusion reasoning as Publish above. */}
            {survey?.status === "PUBLISHED" && canPublish ? (
              <div
                role="status"
                className="border-border bg-muted/40 mb-4 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <Check className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <p className="text-foreground text-sm">{t("publishedEditNotice")}</p>
              </div>
            ) : null}

            {survey?.status === "SUPERSEDED" ? (
              <div
                role="status"
                className="border-border bg-muted/40 mb-4 flex items-start gap-2.5 rounded-md border p-3.5"
              >
                <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <p className="text-muted-foreground text-sm">{t("supersededNotice")}</p>
              </div>
            ) : null}

            {dirty ? (
              <p className="text-muted-foreground mb-4 text-xs">
                {t("unsavedChangesNote")}
              </p>
            ) : null}
            {error ? <p className="text-destructive mb-4 text-sm">{error}</p> : null}

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
                            {option.name}
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
                    <div>
                      <h2 className="text-foreground text-sm font-semibold">
                        {t("sampleDescriptionTitle")}
                      </h2>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("sampleDescriptionSubtitle")}
                      </p>
                    </div>

                    {isEditable ? (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="sample-target-group">
                              {t("targetGroupLabel")}
                            </Label>
                            <Combobox
                              aria-label={t("targetGroupLabel")}
                              items={
                                // Preserves an older survey's free-text value
                                // (from before this became a fixed-vocabulary
                                // picker) as a selectable item, so reopening
                                // this step never silently blanks it out.
                                targetGroup &&
                                !targetRespondentOptions.includes(targetGroup)
                                  ? [
                                      { value: targetGroup, label: targetGroup },
                                      ...targetRespondentOptions.map((v) => ({
                                        value: v,
                                        label: v,
                                      })),
                                    ]
                                  : targetRespondentOptions.map((v) => ({
                                      value: v,
                                      label: v,
                                    }))
                              }
                              value={targetGroup || null}
                              onSelect={setTargetGroup}
                              placeholder={t("targetGroupPlaceholder")}
                              searchPlaceholder={t("targetGroupSearchPlaceholder")}
                              emptyText={t("targetGroupEmpty")}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="sample-expected-size">
                              {t("expectedSampleSizeLabel")}
                            </Label>
                            <Input
                              id="sample-expected-size"
                              type="number"
                              min={1}
                              step={1}
                              value={expectedSampleSize}
                              onChange={(e) => setExpectedSampleSize(e.target.value)}
                              placeholder={t("expectedSampleSizePlaceholder")}
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="sample-selection-approach">
                            {t("selectionApproachLabel")}
                          </Label>
                          <Textarea
                            id="sample-selection-approach"
                            rows={3}
                            value={selectionApproach}
                            onChange={(e) => setSelectionApproach(e.target.value)}
                            placeholder={t("selectionApproachPlaceholder")}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="sample-geographic-coverage">
                            {t("geographicCoverageLabel")}
                          </Label>
                          <Input
                            id="sample-geographic-coverage"
                            value={geographicCoverage}
                            onChange={(e) => setGeographicCoverage(e.target.value)}
                            placeholder={t("geographicCoveragePlaceholder")}
                          />
                        </div>
                        {sampleDescriptionError ? (
                          <p className="text-destructive text-sm">
                            {sampleDescriptionError}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between">
                          <p className="text-muted-foreground text-xs">
                            {t("sampleDescriptionHint")}
                          </p>
                          <LoadingButton
                            type="button"
                            size="sm"
                            variant="outline"
                            isLoading={savingSampleDescription}
                            onClick={saveSampleDescription}
                            text={
                              savingSampleDescription
                                ? t("saving")
                                : t("sampleDescriptionSave")
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground text-xs">
                            {t("targetGroupLabel")}
                          </dt>
                          <dd className="text-foreground text-sm">
                            {survey.targetGroup ?? t("sampleDescriptionNotProvided")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">
                            {t("expectedSampleSizeLabel")}
                          </dt>
                          <dd className="text-foreground text-sm tabular-nums">
                            {survey.expectedSampleSize ??
                              t("sampleDescriptionNotProvided")}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground text-xs">
                            {t("selectionApproachLabel")}
                          </dt>
                          <dd className="text-foreground text-sm whitespace-pre-wrap">
                            {survey.selectionApproach ??
                              t("sampleDescriptionNotProvided")}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground text-xs">
                            {t("geographicCoverageLabel")}
                          </dt>
                          <dd className="text-foreground text-sm">
                            {survey.geographicCoverage ??
                              t("sampleDescriptionNotProvided")}
                          </dd>
                        </div>
                      </dl>
                    )}
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
                                    <p dir="auto" className="text-foreground text-sm">
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

                                  {q.domain ? (
                                    <div>
                                      <p className="text-muted-foreground text-xs font-medium">
                                        {t("domainLabel")}
                                      </p>
                                      <p className="text-foreground text-sm">
                                        {q.domain}
                                        {q.subDomain ? ` · ${q.subDomain}` : ""}
                                      </p>
                                    </div>
                                  ) : null}

                                  {q.kpi ? (
                                    <div>
                                      <p className="text-muted-foreground text-xs font-medium">
                                        {t("kpiLabel")}
                                      </p>
                                      <p className="text-foreground text-sm">{q.kpi}</p>
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
                                  <p dir="auto" className="text-foreground text-sm">
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

                                {q.domain ? (
                                  <div>
                                    <p className="text-muted-foreground text-xs font-medium">
                                      {t("domainLabel")}
                                    </p>
                                    <p className="text-foreground text-sm">
                                      {q.domain}
                                      {q.subDomain ? ` · ${q.subDomain}` : ""}
                                    </p>
                                  </div>
                                ) : null}

                                {q.kpi ? (
                                  <div>
                                    <p className="text-muted-foreground text-xs font-medium">
                                      {t("kpiLabel")}
                                    </p>
                                    <p className="text-foreground text-sm">{q.kpi}</p>
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

                {/* RIO-FR-012 (client-confirmed): custom questions are
                    follow-on scope pending a proper review/approval
                    workflow — Researchers now work from the Question Bank
                    only, so there's no "add" entry point here any more.
                    This card stays purely for viewing/managing whatever a
                    survey already had before this change; it's simply
                    absent for anything that never had any. */}
                {additional.length > 0 ? (
                  <Card>
                    <CardContent className="space-y-4 p-6">
                      <h2 className="text-foreground text-sm font-semibold">
                        {t("additionalHeading")}
                      </h2>
                      <p className="text-muted-foreground text-xs">
                        {t("additionalDescription")}
                      </p>

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
                              <p dir="auto" className="text-foreground text-sm">
                                {q.questionText}
                              </p>
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
                    </CardContent>
                  </Card>
                ) : null}
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
            {survey?.status === "SUBMITTED" ? (
              <div className="space-y-2">
                <Label htmlFor="reject-reason-code">
                  {t("rejectReasonCodeLabel")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={reasonCode}
                  onValueChange={(value) => {
                    setReasonCode(value as RejectionReasonCode);
                    if (reasonCodeError) setReasonCodeError(null);
                    if (value !== "REJ_99" && commentsError) setCommentsError(null);
                  }}
                >
                  <SelectTrigger
                    id="reject-reason-code"
                    className="w-full"
                    aria-invalid={reasonCodeError ? true : undefined}
                  >
                    <SelectValue placeholder={t("rejectReasonCodePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="w-(--radix-select-trigger-width)">
                    {Object.entries(REJECTION_REASON_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code} className="whitespace-normal">
                        {code.replace("_", "-")} — {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reasonCodeError ? (
                  <p className="text-destructive text-sm">{reasonCodeError}</p>
                ) : null}
              </div>
            ) : null}
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

        <Dialog
          open={approveOpen}
          onOpenChange={(open) => {
            if (submitting || approvingSubmitted) return;
            setApproveOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("approveDialogTitle")}</DialogTitle>
              <DialogDescription>{t("approveDialogDescription")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="approve-comments">
                {t("commentsLabel")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="approve-comments"
                rows={5}
                value={approveComments}
                onChange={(e) => {
                  setApproveComments(e.target.value);
                  if (approveCommentsError) setApproveCommentsError(null);
                }}
                placeholder={t("approveCommentsPlaceholder")}
                aria-invalid={approveCommentsError ? true : undefined}
              />
              {approveCommentsError ? (
                <p className="text-destructive text-sm">{approveCommentsError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setApproveOpen(false)}
                disabled={submitting || approvingSubmitted}
              >
                {t("cancel")}
              </Button>
              <LoadingButton
                type="button"
                isLoading={submitting || approvingSubmitted}
                onClick={confirmApprove}
                text={
                  submitting || approvingSubmitted ? t("approving") : t("confirmApprove")
                }
              />
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Client-confirmed (Aug 13 call): a reason is required for every
            question the Approver removes while reviewing a SUBMITTED
            survey — prompted right at the moment of removal (see
            removeRecommended/removeAdditional), not batched at Save time.
            Free text for now — a fixed set of codes was explicitly
            deferred until the client hands one over. */}
        <Dialog
          open={pendingRemoval !== null}
          onOpenChange={(open) => {
            if (!open) cancelRemoval();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("removalReasonDialogTitle")}</DialogTitle>
              <DialogDescription>
                {pendingRemoval?.label
                  ? t("removalReasonDialogDescription", {
                      question: pendingRemoval.label,
                    })
                  : null}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="removal-reason">
                {t("removalReasonLabel")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="removal-reason"
                rows={4}
                value={removalReasonInput}
                onChange={(e) => {
                  setRemovalReasonInput(e.target.value);
                  if (removalReasonError) setRemovalReasonError(null);
                }}
                placeholder={t("removalReasonPlaceholder")}
                aria-invalid={removalReasonError ? true : undefined}
              />
              {removalReasonError ? (
                <p className="text-destructive text-sm">{removalReasonError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={cancelRemoval}>
                {t("cancel")}
              </Button>
              <Button type="button" variant="destructive" onClick={confirmRemoval}>
                {t("removeQuestion")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
