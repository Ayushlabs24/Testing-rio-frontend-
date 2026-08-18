"use client";

import { MoreVertical, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
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
import { QUESTION_BANK_PAGE_SIZE } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { questionsService } from "@/services/questions/questions.service";
import type { QuestionManagementItem } from "@/services/questions/questions.types";

const ALL = "all";

interface EditFormState {
  questionText: string;
  indicator: string;
  kpi: string;
}

/**
 * RIO-FR-012 — Question Bank management (edit / deactivate / reactivate).
 * Read is available to anyone who can view this settings page
 * (methodologyQuestionBank:read); the mutating actions below are gated on
 * surveyBuilder:write, matching the backend's own gate on these endpoints
 * exactly — see QuestionsController.
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
  const canWrite = usePermission("surveyBuilder", "write");

  const [questions, setQuestions] = useState<QuestionManagementItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const [editingQuestion, setEditingQuestion] = useState<QuestionManagementItem | null>(
    null,
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    questionText: "",
    indicator: "",
    kpi: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  useEffect(() => {
    loadQuestions();
  }, []);

  const domainOptions = useMemo(() => {
    const names = new Set((questions ?? []).map((q) => q.domain));
    return Array.from(names).sort();
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (questions ?? []).filter((q) => {
      if (domainFilter !== ALL && q.domain !== domainFilter) return false;
      if (statusFilter === "active" && !q.isActive) return false;
      if (statusFilter === "inactive" && q.isActive) return false;
      if (!query) return true;
      return (
        q.questionId.toLowerCase().includes(query) ||
        q.questionText.toLowerCase().includes(query) ||
        (q.indicator ?? "").toLowerCase().includes(query) ||
        (q.kpi ?? "").toLowerCase().includes(query)
      );
    });
  }, [questions, searchQuery, domainFilter, statusFilter]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredQuestions.length / QUESTION_BANK_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const pagedQuestions = filteredQuestions.slice(
    (currentPage - 1) * QUESTION_BANK_PAGE_SIZE,
    currentPage * QUESTION_BANK_PAGE_SIZE,
  );

  function openEdit(question: QuestionManagementItem) {
    setEditingQuestion(question);
    setEditForm({
      questionText: question.questionText,
      indicator: question.indicator ?? "",
      kpi: question.kpi ?? "",
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
      });
      setEditDialogOpen(false);
      loadQuestions();
    } catch {
      setFormError(t("genericError"));
    } finally {
      setSaving(false);
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
      loadQuestions();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={domainFilter}
              onValueChange={(val) => {
                setDomainFilter(val);
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
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 text-xs"
            />
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
                <TableHead>{t("columns.weight")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions === null ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex justify-center">
                      <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredQuestions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {loadFailed ? t("loadError") : t("noResults")}
                  </TableCell>
                </TableRow>
              ) : (
                pagedQuestions.map((q) => (
                  <TableRow key={q.id} className={q.isActive ? undefined : "opacity-60"}>
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
                    <TableCell className="text-muted-foreground text-xs">
                      {q.priorityWeight ?? "—"}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-right">
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
            <div className="border-border flex justify-end border-t px-4 py-3">
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
                previousLabel={t("pagination.previous")}
                nextLabel={t("pagination.next")}
                pageLabel={(p, count) => t("pagination.label", { page: p, count })}
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
    </>
  );
}
