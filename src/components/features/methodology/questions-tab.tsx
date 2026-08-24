"use client";

import { MoreVertical, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  QUESTION_BANK_PAGE_SIZE,
  QUESTION_BANK_PAGE_SIZE_OPTIONS,
} from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { domainsService } from "@/services/domains/domains.service";
import type { DomainWithSubDomains } from "@/services/domains/domains.types";
import { studyConfigService } from "@/services/study-config/study-config.service";
import { questionsService } from "@/services/questions/questions.service";
import type {
  QuestionAnswerType,
  QuestionManagementItem,
} from "@/services/questions/questions.types";
import { ApiError } from "@/services/api/types";

const ALL = "all";
// Radix Select items can't carry an empty-string value — this sentinel
// stands in for "no Target Sector tag" in both dropdowns.
const NONE = "__none__";

interface EditFormState {
  questionText: string;
  indicator: string;
  kpi: string;
  targetSector: string;
}

const ANSWER_OPTION_TYPES: QuestionAnswerType[] = ["select", "multiselect", "checklist"];

interface CreateFormState {
  questionId: string;
  domain: string;
  subDomain: string;
  indicator: string;
  kpi: string;
  questionText: string;
  answerType: QuestionAnswerType;
  answerOptionsText: string;
  requiredOptional: "required" | "optional";
  targetSector: string;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  questionId: "",
  domain: "",
  subDomain: "",
  indicator: "",
  kpi: "",
  questionText: "",
  answerType: "select",
  answerOptionsText: "",
  requiredOptional: "required",
  targetSector: NONE,
};

/**
 * RIO-FR-012 (Q30/Q31, client-confirmed 2026-08-20) — Question Bank
 * management (edit / deactivate / reactivate), now with versioning +
 * approval. Read is available to anyone who can view this settings page
 * (methodologyQuestionBank:read); initiating a change is gated on
 * methodologyQuestionBank:write (System Admin/NCNP Admin only); approving
 * or rejecting a pending change is gated on methodologyQuestionBank:approve
 * (Human Reviewer) — matching the backend's gates exactly, see
 * QuestionsController.
 *
 * Every change now creates a pending version rather than applying
 * immediately — the management list keeps showing the pre-change (still
 * current + approved) row until a Human Reviewer approves it.
 *
 * Domain/Sub-domain are intentionally NOT editable here even though the
 * backend's UpdateQuestionInput technically allows it: AI recommendation
 * (generateSuggestedQuestions) and the Survey Builder's own question-bank
 * filter both match a Need's Domain/Sub-domain against this exact string,
 * so silently renaming it here would break that matching for every survey
 * built afterward. Only the safe, purely descriptive fields — question
 * text, indicator, KPI — are editable from this screen.
 */
export function QuestionsTab() {
  const t = useTranslations("app.settings.methodology.questions");
  const canWrite = usePermission("methodologyQuestionBank", "write");
  const canApprove = usePermission("methodologyQuestionBank", "approve");

  const [questions, setQuestions] = useState<QuestionManagementItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>(ALL);
  const [subDomainFilter, setSubDomainFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [targetSectorFilter, setTargetSectorFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(QUESTION_BANK_PAGE_SIZE);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detailQuestion, setDetailQuestion] = useState<QuestionManagementItem | null>(
    null,
  );

  const [domainsTree, setDomainsTree] = useState<DomainWithSubDomains[]>([]);
  const [targetSectorOptions, setTargetSectorOptions] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creatingQuestion, setCreatingQuestion] = useState(false);

  const [editingQuestion, setEditingQuestion] = useState<QuestionManagementItem | null>(
    null,
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    questionText: "",
    indicator: "",
    kpi: "",
    targetSector: NONE,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [pending, setPending] = useState<QuestionManagementItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QuestionManagementItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const loadQuestions = () => {
    questionsService
      .list()
      .then((rows) => {
        setQuestions(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setQuestions([]);
        setLoadFailed(true);
      });
  };

  const loadPending = () => {
    if (!canApprove) return;
    setPendingLoading(true);
    questionsService
      .listPendingApprovals()
      .then((rows) => setPending(rows))
      .catch(() => setPending([]))
      .finally(() => setPendingLoading(false));
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (!canWrite) return;
    domainsService
      .listWithSubDomains()
      .then(setDomainsTree)
      .catch(() => setDomainsTree([]));
  }, [canWrite]);

  // Unlike domainsTree above (only needed for the create/edit forms, so
  // gated on write access), Target Sector options also back the filter
  // dropdown every viewer sees — fetched unconditionally, matching the
  // backend route's own methodologyQuestionBank:read gate.
  useEffect(() => {
    studyConfigService
      .listTargetSectors()
      .then((options) =>
        setTargetSectorOptions(options.filter((o) => o.isActive).map((o) => o.name)),
      )
      .catch(() => setTargetSectorOptions([]));
  }, []);

  useEffect(() => {
    queueMicrotask(() => loadPending());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const domainOptions = useMemo(() => {
    const names = new Set((questions ?? []).map((q) => q.domain));
    return Array.from(names).sort();
  }, [questions]);

  // Scoped to the currently-selected Domain (same "narrow the second filter
  // by the first" pattern as the Study form's Governorate -> Center pair) —
  // showing every sub-domain platform-wide when a Domain is already chosen
  // would just list irrelevant options.
  const subDomainOptions = useMemo(() => {
    const names = new Set(
      (questions ?? [])
        .filter((q) => domainFilter === ALL || q.domain === domainFilter)
        .map((q) => q.subDomain),
    );
    return Array.from(names).sort();
  }, [questions, domainFilter]);

  // A pending EDIT's row shares its original's questionId (only id/version/
  // isCurrentVersion differ — see createPendingVersion) — so this set finds
  // "does this questionId have a change awaiting approval right now" without
  // needing previousVersionId at all. A pending NEW question is covered
  // separately below via its own approvalStatus, since it has no original
  // row to mark.
  const questionIdsWithPendingChange = useMemo(
    () => new Set(pending.map((p) => p.questionId)),
    [pending],
  );

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (questions ?? []).filter((q) => {
      if (domainFilter !== ALL && q.domain !== domainFilter) return false;
      if (subDomainFilter !== ALL && q.subDomain !== subDomainFilter) return false;
      if (statusFilter === "active" && !q.isActive) return false;
      if (statusFilter === "inactive" && q.isActive) return false;
      if (targetSectorFilter === NONE && q.targetSector !== null) return false;
      if (
        targetSectorFilter !== ALL &&
        targetSectorFilter !== NONE &&
        q.targetSector !== targetSectorFilter
      )
        return false;
      if (!query) return true;
      return (
        q.questionId.toLowerCase().includes(query) ||
        q.questionText.toLowerCase().includes(query) ||
        (q.indicator ?? "").toLowerCase().includes(query) ||
        (q.kpi ?? "").toLowerCase().includes(query)
      );
    });
  }, [
    questions,
    searchQuery,
    domainFilter,
    subDomainFilter,
    statusFilter,
    targetSectorFilter,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedQuestions = filteredQuestions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function openEdit(question: QuestionManagementItem) {
    setEditingQuestion(question);
    setEditForm({
      questionText: question.questionText,
      indicator: question.indicator ?? "",
      kpi: question.kpi ?? "",
      targetSector: question.targetSector ?? NONE,
    });
    setFormError(null);
    setEditDialogOpen(true);
  }

  async function submitEdit() {
    if (!editingQuestion) return;
    setSaving(true);
    setFormError(null);
    try {
      await questionsService.update(editingQuestion.id, {
        questionText: editForm.questionText.trim(),
        indicator: editForm.indicator.trim() || null,
        kpi: editForm.kpi.trim() || null,
        targetSector: editForm.targetSector === NONE ? null : editForm.targetSector,
      });
      setEditDialogOpen(false);
      setSuccessMessage(t("submittedForApproval"));
      loadQuestions();
      loadPending();
    } catch {
      setFormError(t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
    setCreateOpen(true);
  }

  async function submitCreate() {
    const answerOptions = createForm.answerOptionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      ANSWER_OPTION_TYPES.includes(createForm.answerType) &&
      answerOptions.length === 0
    ) {
      setCreateError(t("create.answerOptionsRequired"));
      return;
    }
    setCreatingQuestion(true);
    setCreateError(null);
    try {
      await questionsService.create({
        questionId: createForm.questionId.trim(),
        domain: createForm.domain,
        subDomain: createForm.subDomain,
        indicator: createForm.indicator.trim() || undefined,
        kpi: createForm.kpi.trim() || undefined,
        questionText: createForm.questionText.trim(),
        answerType: createForm.answerType,
        answerOptions: ANSWER_OPTION_TYPES.includes(createForm.answerType)
          ? answerOptions
          : undefined,
        requiredOptional: createForm.requiredOptional,
        targetSector:
          createForm.targetSector === NONE ? undefined : createForm.targetSector,
      });
      setCreateOpen(false);
      setSuccessMessage(t("submittedForApproval"));
      loadQuestions();
      loadPending();
    } catch (err) {
      setCreateError(
        err instanceof ApiError && err.code === "QUESTION_ID_TAKEN"
          ? t("create.questionIdTaken", { questionId: createForm.questionId })
          : t("genericError"),
      );
    } finally {
      setCreatingQuestion(false);
    }
  }

  async function toggleActive(question: QuestionManagementItem) {
    setTogglingId(question.id);
    try {
      if (question.isActive) {
        await questionsService.deactivate(question.id);
      } else {
        await questionsService.reactivate(question.id);
      }
      setSuccessMessage(t("submittedForApproval"));
      loadQuestions();
      loadPending();
    } finally {
      setTogglingId(null);
    }
  }

  async function approvePending(question: QuestionManagementItem) {
    setDecidingId(question.id);
    try {
      await questionsService.approve(question.id);
      loadPending();
      loadQuestions();
    } finally {
      setDecidingId(null);
    }
  }

  function openReject(question: QuestionManagementItem) {
    setRejectTarget(question);
    setRejectReason("");
    setRejectError(null);
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    setDecidingId(rejectTarget.id);
    setRejectError(null);
    try {
      await questionsService.reject(rejectTarget.id, rejectReason.trim());
      setRejectTarget(null);
      loadPending();
    } catch {
      setRejectError(t("genericError"));
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <>
      {successMessage ? (
        <div
          role="status"
          className="border-badge-success bg-badge-success text-badge-success-foreground mb-4 rounded-md border px-4 py-3 text-sm font-medium"
        >
          {successMessage}
        </div>
      ) : null}

      {canApprove ? (
        <Card className="mb-6">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-sm font-semibold">
                {t("pendingApprovals.heading", { count: pending.length })}
              </h3>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {pendingLoading ? (
              <div className="flex justify-center py-8">
                <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            ) : pending.length === 0 ? (
              <p className="text-muted-foreground px-4 pb-4 text-xs">
                {t("pendingApprovals.empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.questionId")}</TableHead>
                    <TableHead>{t("columns.question")}</TableHead>
                    <TableHead>{t("pendingApprovals.submittedAt")}</TableHead>
                    <TableHead className="text-right">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="text-foreground font-mono text-xs font-medium">
                        {q.questionId}
                      </TableCell>
                      <TableCell dir="auto" className="max-w-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-foreground truncate text-xs"
                            title={q.questionText}
                          >
                            {q.questionText}
                          </span>
                          {!q.isActive ? (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              {t("inactive")}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                        {q.submittedAt ? new Date(q.submittedAt).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={decidingId === q.id}
                            onClick={() => approvePending(q)}
                          >
                            {t("pendingApprovals.approve")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive text-xs"
                            disabled={decidingId === q.id}
                            onClick={() => openReject(q)}
                          >
                            {t("pendingApprovals.reject")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col items-stretch gap-4 py-4">
          <div className="flex w-full items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">{t("bankHeading")}</h3>
            {canWrite ? (
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="size-4" />
                {t("create.addQuestion")}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={domainFilter}
                onValueChange={(val) => {
                  setDomainFilter(val);
                  // A sub-domain scoped to the previous Domain rarely applies
                  // to the new one — reset rather than silently filter to
                  // (usually) nothing.
                  setSubDomainFilter(ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-56 text-xs">
                  <SelectValue placeholder={t("filterDomain")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allDomains")}</SelectItem>
                  {domainOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={subDomainFilter}
                onValueChange={(val) => {
                  setSubDomainFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-56 text-xs">
                  <SelectValue placeholder={t("filterSubDomain")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allSubDomains")}</SelectItem>
                  {subDomainOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder={t("filterStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="inactive">{t("inactive")}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={targetSectorFilter}
                onValueChange={(val) => {
                  setTargetSectorFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48 text-xs">
                  <SelectValue placeholder={t("filterTargetSector")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allTargetSectors")}</SelectItem>
                  <SelectItem value={NONE}>{t("targetSectorNone")}</SelectItem>
                  {targetSectorOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative w-full sm:w-96">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.questionId")}</TableHead>
                <TableHead>{t("columns.question")}</TableHead>
                <TableHead>{t("columns.domain")}</TableHead>
                <TableHead>{t("columns.indicator")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions === null ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex justify-center">
                      <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredQuestions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {loadFailed ? t("loadError") : t("noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                pagedQuestions.map((q) => (
                  <TableRow
                    key={q.id}
                    className={cn(
                      "cursor-pointer",
                      q.isActive ? undefined : "opacity-60",
                    )}
                    onClick={() => setDetailQuestion(q)}
                  >
                    <TableCell className="text-foreground font-mono text-xs font-medium">
                      {q.questionId}
                    </TableCell>
                    <TableCell
                      dir="auto"
                      className="text-foreground max-w-xs truncate text-xs"
                      title={q.questionText}
                    >
                      {q.questionText}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <div>{q.domain}</div>
                      <div className="text-[10px]">{q.subDomain}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {q.indicator ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={q.isActive ? "default" : "outline"}
                          className={
                            q.isActive
                              ? "bg-badge-success text-badge-success-foreground border-transparent"
                              : undefined
                          }
                        >
                          {q.isActive ? t("active") : t("inactive")}
                        </Badge>
                        {q.approvalStatus === "pending_approval" ||
                        questionIdsWithPendingChange.has(q.questionId) ? (
                          <Badge
                            variant="outline"
                            className="border-badge-warning/40 bg-badge-warning/10 text-badge-warning-foreground"
                          >
                            {t("pendingApprovalBadge")}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canWrite ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={t("actions")}
                              disabled={togglingId === q.id}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(q)}>
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive(q)}>
                              {q.isActive ? t("deactivate") : t("activate")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filteredQuestions.length > 0 ? (
            <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-40"
                  aria-label={t("rowsPerPageLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_BANK_PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {t("rowsPerPageLabel")}: {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
                previousLabel={t("pagination.previous")}
                nextLabel={t("pagination.next")}
                pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                className="sm:w-auto"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("editQuestion")} — {editingQuestion?.questionId}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question-text">{t("questionTextLabel")}</Label>
              <Textarea
                id="question-text"
                dir="auto"
                rows={3}
                value={editForm.questionText}
                onChange={(e) =>
                  setEditForm({ ...editForm, questionText: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-indicator">{t("indicatorLabel")}</Label>
              <Input
                id="question-indicator"
                value={editForm.indicator}
                onChange={(e) => setEditForm({ ...editForm, indicator: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-kpi">{t("kpiLabel")}</Label>
              <Input
                id="question-kpi"
                value={editForm.kpi}
                onChange={(e) => setEditForm({ ...editForm, kpi: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="question-target-sector">{t("targetSectorLabel")}</Label>
              <Select
                value={editForm.targetSector}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, targetSector: value })
                }
              >
                <SelectTrigger id="question-target-sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("targetSectorNone")}</SelectItem>
                  {targetSectorOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t("targetSectorHint")}</p>
            </div>
            <p className="text-muted-foreground text-xs">{t("domainLockedHint")}</p>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={submitEdit}
              disabled={saving || !editForm.questionText.trim()}
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("create.addQuestion")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-question-id">
                {t("columns.questionId")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-question-id"
                placeholder={t("create.questionIdPlaceholder")}
                value={createForm.questionId}
                onChange={(e) =>
                  setCreateForm({ ...createForm, questionId: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {t("columns.domain")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={createForm.domain}
                  onValueChange={(value) =>
                    setCreateForm({ ...createForm, domain: value, subDomain: "" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("filterDomain")} />
                  </SelectTrigger>
                  <SelectContent>
                    {domainsTree.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {t("detail.subDomain")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={createForm.subDomain}
                  onValueChange={(value) =>
                    setCreateForm({ ...createForm, subDomain: value })
                  }
                  disabled={!createForm.domain}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("filterSubDomain")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      domainsTree.find((d) => d.name === createForm.domain)?.subDomains ??
                      []
                    ).map((sd) => (
                      <SelectItem key={sd.id} value={sd.name}>
                        {sd.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-indicator">{t("indicatorLabel")}</Label>
                <Input
                  id="create-indicator"
                  value={createForm.indicator}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, indicator: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-kpi">{t("kpiLabel")}</Label>
                <Input
                  id="create-kpi"
                  value={createForm.kpi}
                  onChange={(e) => setCreateForm({ ...createForm, kpi: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-target-sector">{t("targetSectorLabel")}</Label>
              <Select
                value={createForm.targetSector}
                onValueChange={(value) =>
                  setCreateForm({ ...createForm, targetSector: value })
                }
              >
                <SelectTrigger id="create-target-sector">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("targetSectorNone")}</SelectItem>
                  {targetSectorOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{t("targetSectorHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-question-text">
                {t("questionTextLabel")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="create-question-text"
                dir="auto"
                rows={3}
                value={createForm.questionText}
                onChange={(e) =>
                  setCreateForm({ ...createForm, questionText: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("create.answerTypeLabel")}</Label>
                <Select
                  value={createForm.answerType}
                  onValueChange={(value) =>
                    setCreateForm({
                      ...createForm,
                      answerType: value as QuestionAnswerType,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">{t("create.answerTypeSelect")}</SelectItem>
                    <SelectItem value="multiselect">
                      {t("create.answerTypeMultiselect")}
                    </SelectItem>
                    <SelectItem value="numeric">
                      {t("create.answerTypeNumeric")}
                    </SelectItem>
                    <SelectItem value="checklist">
                      {t("create.answerTypeChecklist")}
                    </SelectItem>
                    <SelectItem value="open_ended">
                      {t("create.answerTypeOpenEnded")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("create.requiredLabel")}</Label>
                <Select
                  value={createForm.requiredOptional}
                  onValueChange={(value) =>
                    setCreateForm({
                      ...createForm,
                      requiredOptional: value as "required" | "optional",
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">{t("create.required")}</SelectItem>
                    <SelectItem value="optional">{t("create.optional")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {ANSWER_OPTION_TYPES.includes(createForm.answerType) ? (
              <div className="space-y-2">
                <Label htmlFor="create-answer-options">
                  {t("create.answerOptionsLabel")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="create-answer-options"
                  dir="auto"
                  rows={3}
                  placeholder={t("create.answerOptionsPlaceholder")}
                  value={createForm.answerOptionsText}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, answerOptionsText: e.target.value })
                  }
                />
                <p className="text-muted-foreground text-xs">
                  {t("create.answerOptionsHint")}
                </p>
              </div>
            ) : null}

            <p className="text-muted-foreground text-xs">{t("create.approvalHint")}</p>
            {createError ? (
              <p className="text-destructive text-sm">{createError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={submitCreate}
              disabled={
                creatingQuestion ||
                !createForm.questionId.trim() ||
                !createForm.domain ||
                !createForm.subDomain ||
                !createForm.questionText.trim()
              }
            >
              {creatingQuestion ? t("saving") : t("create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => !open && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("pendingApprovals.rejectTitle")} — {rejectTarget?.questionId}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">{t("pendingApprovals.reasonLabel")}</Label>
              <Textarea
                id="reject-reason"
                dir="auto"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            {rejectError ? (
              <p className="text-destructive text-sm">{rejectError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={submitReject}
              disabled={decidingId === rejectTarget?.id || !rejectReason.trim()}
            >
              {decidingId === rejectTarget?.id
                ? t("saving")
                : t("pendingApprovals.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailQuestion !== null}
        onOpenChange={(open) => !open && setDetailQuestion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.title")}</DialogTitle>
          </DialogHeader>
          {detailQuestion ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {t("columns.questionId")}
                </p>
                <p className="text-foreground font-mono text-sm">
                  {detailQuestion.questionId}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {t("columns.question")}
                </p>
                <p dir="auto" className="text-foreground text-sm">
                  {detailQuestion.questionText}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("columns.domain")}
                  </p>
                  <p className="text-foreground text-sm">{detailQuestion.domain}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("detail.subDomain")}
                  </p>
                  <p className="text-foreground text-sm">{detailQuestion.subDomain}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("columns.indicator")}
                  </p>
                  <p className="text-foreground text-sm">
                    {detailQuestion.indicator ?? "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("detail.kpi")}
                  </p>
                  <p className="text-foreground text-sm">{detailQuestion.kpi ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("targetSectorLabel")}
                  </p>
                  <p className="text-foreground text-sm">
                    {detailQuestion.targetSector ?? "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("detail.answerType")}
                  </p>
                  <p className="text-foreground text-sm">{detailQuestion.answerType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("columns.status")}
                  </p>
                  <p className="text-foreground text-sm">
                    {detailQuestion.isActive ? t("active") : t("inactive")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailQuestion(null)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
