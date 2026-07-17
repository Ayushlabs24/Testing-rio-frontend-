"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Save,
  HelpCircle,
  AlertCircle,
  Loader2,
  FileQuestion,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Question, type Survey, type QuestionOption } from "@/services/surveys/surveys.service";
import type { Study } from "@/services/studies/studies.types";

interface StudyAiSurveyProps {
  study: Study;
  onStudyUpdate: (updated: Study) => void;
}

export function StudyAiSurvey({ study, onStudyUpdate }: StudyAiSurveyProps) {
  // Domain Suggestion states
  const [suggestion, setSuggestion] = useState<{
    id: string;
    suggestedDomain: string;
    suggestedSubDomain: string;
    confidence: number;
    reason: string;
  } | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  // Manual input states
  const [isManualMode, setIsManualMode] = useState(false);
  const [domainOptions, setDomainOptions] = useState<QuestionOption[]>([]);
  const [manualDomain, setManualDomain] = useState<string>("");
  const [manualSubDomain, setManualSubDomain] = useState<string>("");

  // Survey Builder states
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [isSurveyLoading, setIsSurveyLoading] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBankQuestionId, setSelectedBankQuestionId] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Load initial options & survey if domain is already approved
  useEffect(() => {
    surveysService.getDomainOptions()
      .then(setDomainOptions)
      .catch(console.error);

    if (study.domain && study.subDomain) {
      setIsSurveyLoading(true);
      surveysService.getSurveyByStudyId(study.id)
        .then((s) => {
          setSurvey(s);
          if (s) {
            // Pre-load available questions in this domain
            surveysService.getQuestions(study.domain!, study.subDomain!)
              .then(setBankQuestions)
              .catch(console.error);
          }
        })
        .catch(console.error)
        .finally(() => setIsSurveyLoading(false));
    }
  }, [study.id, study.domain, study.subDomain]);

  // Request AI Domain classification suggestion
  const handleGetSuggestion = async () => {
    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const res = await studiesService.suggestDomain(study.id);
      setSuggestion(res);
      setManualDomain(res.suggestedDomain);
      setManualSubDomain(res.suggestedSubDomain);
    } catch (err: any) {
      setSuggestionError(err.message || "Failed to fetch domain suggestions.");
    } finally {
      setIsSuggesting(false);
    }
  };

  // Approve AI Suggestion
  const handleApproveSuggestion = async () => {
    if (!suggestion) return;
    setIsSuggesting(true);
    try {
      const updated = await studiesService.approveDomain(study.id, {
        domain: suggestion.suggestedDomain,
        subDomain: suggestion.suggestedSubDomain,
        aiSuggestionId: suggestion.id,
      });
      onStudyUpdate(updated);
    } catch (err: any) {
      setSuggestionError(err.message || "Failed to approve domain selection.");
    } finally {
      setIsSuggesting(false);
    }
  };

  // Submit Manual Domain classification
  const handleSaveManualSelection = async () => {
    if (!manualDomain || !manualSubDomain) return;
    setIsSuggesting(true);
    try {
      const updated = await studiesService.approveDomain(study.id, {
        domain: manualDomain,
        subDomain: manualSubDomain,
        aiSuggestionId: suggestion?.id, // link to suggestion if it existed
      });
      onStudyUpdate(updated);
      setIsManualMode(false);
    } catch (err: any) {
      setSuggestionError(err.message || "Failed to save manual selection.");
    } finally {
      setIsSuggesting(false);
    }
  };

  // Recommend survey questions
  const handleRecommendQuestions = async () => {
    setIsRecommending(true);
    try {
      const res = await surveysService.recommendQuestions(study.id);
      setSurvey(res);
      // Pre-load available questions in this domain
      const qBank = await surveysService.getQuestions(study.domain!, study.subDomain!);
      setBankQuestions(qBank);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsRecommending(false);
    }
  };

  // Survey Builder edits (reorder, toggle isRequired, remove, add)
  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (!survey) return;
    const questions = [...survey.questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    // Swap elements
    const temp = questions[index];
    questions[index] = questions[targetIndex];
    questions[targetIndex] = temp;

    // Update order values (1-indexed)
    const updated = questions.map((q, idx) => ({ ...q, order: idx + 1 }));
    setSurvey({ ...survey, questions: updated });
  };

  const handleToggleRequired = (index: number, checked: boolean) => {
    if (!survey) return;
    const questions = [...survey.questions];
    questions[index].isRequired = checked;
    setSurvey({ ...survey, questions });
  };

  const handleRemoveQuestion = (index: number) => {
    if (!survey) return;
    const questions = survey.questions.filter((_, idx) => idx !== index);
    const updated = questions.map((q, idx) => ({ ...q, order: idx + 1 }));
    setSurvey({ ...survey, questions: updated });
  };

  const handleAddQuestion = () => {
    if (!survey || !selectedBankQuestionId) return;
    const match = bankQuestions.find(q => q.id === selectedBankQuestionId);
    if (!match) return;

    // Check if already in survey
    if (survey.questions.some(q => q.id === match.id)) {
      setIsAddDialogOpen(false);
      return;
    }

    const newQuestion = {
      ...match,
      order: survey.questions.length + 1,
      isRequired: match.requiredOptional === "required",
    };

    setSurvey({
      ...survey,
      questions: [...survey.questions, newQuestion]
    });
    setSelectedBankQuestionId("");
    setIsAddDialogOpen(false);
  };

  const handleSaveSurveyDraft = async () => {
    if (!survey) return;
    setSaveStatus("saving");
    try {
      // Map frontend elements to backend contract expectations
      const payload = survey.questions.map(q => ({
        questionId: q.id,
        order: q.order,
        isRequired: q.isRequired
      }));
      await surveysService.updateQuestions(survey.id, payload);
      await surveysService.saveDraft(survey.id);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // Helper variables for manual selection lists
  const uniqueDomains = Array.from(new Set(domainOptions.map(opt => opt.domain)));
  const subDomainsForSelected = domainOptions
    .filter(opt => opt.domain === manualDomain)
    .map(opt => opt.subDomain);

  // Filter bank questions to those not already in the survey
  const addableQuestions = bankQuestions.filter(
    bq => !survey?.questions.some(sq => sq.id === bq.id)
  );

  return (
    <div className="space-y-6">
      {/* 1. CLASSIFICATION BLOCK */}
      <Card className="border shadow-sm">
        <div className="bg-muted/30 border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-500" />
            <h3 className="font-semibold text-foreground">Study Classification</h3>
          </div>
          <Badge variant={study.domain ? "success" : "secondary"}>
            {study.domain ? "Classified" : "Pending Classification"}
          </Badge>
        </div>
        <CardContent className="p-6 space-y-4">
          {study.domain && study.subDomain ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-emerald-800 text-sm">Classification Approved</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300">
                      Domain: {study.domain}
                    </Badge>
                    <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300">
                      Sub-Domain: {study.subDomain}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsManualMode(true)}
              >
                Change Classification
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Classify this study to define its focus domain and subdomain. AI can suggest the best fit from the master question bank methodology based on the problem statement.
              </p>

              {!suggestion && !isManualMode && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleGetSuggestion}
                    disabled={isSuggesting}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white"
                  >
                    {isSuggesting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Analysing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Suggest Classification
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsManualMode(true);
                      setManualDomain("");
                      setManualSubDomain("");
                    }}
                  >
                    Select Manually
                  </Button>
                </div>
              )}

              {suggestion && !isManualMode && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-indigo-50/50 border-b px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="size-3.5" /> AI Recommendation
                    </span>
                    <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-transparent">
                      Confidence: {Math.round(suggestion.confidence * 100)}%
                    </Badge>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Suggested Domain</span>
                        <div className="text-sm font-semibold mt-0.5">{suggestion.suggestedDomain}</div>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Suggested Sub-Domain</span>
                        <div className="text-sm font-semibold mt-0.5">{suggestion.suggestedSubDomain}</div>
                      </div>
                    </div>
                    {suggestion.reason && (
                      <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded italic">
                        &ldquo;{suggestion.reason}&rdquo;
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={handleApproveSuggestion} className="bg-emerald-600 hover:bg-emerald-700">
                        Approve Suggestion
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleGetSuggestion}>
                        Regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsManualMode(true);
                          setManualDomain(suggestion.suggestedDomain);
                          setManualSubDomain(suggestion.suggestedSubDomain);
                        }}
                      >
                        Modify Selection
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {suggestionError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  {suggestionError}
                </div>
              )}
            </div>
          )}

          {isManualMode && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <h4 className="font-semibold text-sm">Manual Classification Selection</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="manualDomain">Domain</Label>
                  <Select
                    value={manualDomain}
                    onValueChange={(val) => {
                      setManualDomain(val);
                      setManualSubDomain("");
                    }}
                  >
                    <SelectTrigger id="manualDomain">
                      <SelectValue placeholder="Choose Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueDomains.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manualSubDomain">Sub-Domain</Label>
                  <Select
                    value={manualSubDomain}
                    onValueChange={setManualSubDomain}
                    disabled={!manualDomain}
                  >
                    <SelectTrigger id="manualSubDomain">
                      <SelectValue placeholder="Choose Sub-Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {subDomainsForSelected.map(sd => (
                        <SelectItem key={sd} value={sd}>{sd}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveManualSelection} disabled={!manualDomain || !manualSubDomain}>
                  Save Selection
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsManualMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. SURVEY BUILDER BLOCK */}
      {study.domain && study.subDomain && (
        <Card className="border shadow-sm">
          <div className="bg-muted/30 border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileQuestion className="size-5 text-indigo-500" />
              <h3 className="font-semibold text-foreground">Survey Design &amp; Questions</h3>
            </div>
            {survey && (
              <Badge variant={survey.status === "DRAFT" ? "outline" : "success"}>
                {survey.status}
              </Badge>
            )}
          </div>
          <CardContent className="p-6 space-y-6">
            {isSurveyLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="size-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Loading survey draft...</span>
              </div>
            ) : !survey ? (
              <div className="text-center py-8 space-y-4">
                <div className="max-w-md mx-auto space-y-2">
                  <h4 className="font-semibold text-sm">No Survey Questions Generated Yet</h4>
                  <p className="text-xs text-muted-foreground">
                    Generate the baseline survey questions. Gemini will recommend questions fitting the approved domain/subdomain matching this study&apos;s problem statement.
                  </p>
                </div>
                <Button
                  onClick={handleRecommendQuestions}
                  disabled={isRecommending}
                  className="gap-2"
                >
                  {isRecommending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Recommending Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Generate Survey Questions
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Form-style interactive survey builder */}
                <div className="space-y-4">
                  {survey.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="border rounded-lg p-4 bg-background shadow-sm hover:border-slate-300 transition-all flex gap-4"
                    >
                      {/* Left: Reorder controls */}
                      <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={idx === 0}
                          onClick={() => handleMoveQuestion(idx, "up")}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={idx === survey.questions.length - 1}
                          onClick={() => handleMoveQuestion(idx, "down")}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>

                      {/* Middle: Question details */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {q.questionText}
                          </p>
                          <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                            {q.answerType}
                          </Badge>
                        </div>

                        {q.answerOptions && q.answerOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {q.answerOptions.map((opt, oIdx) => (
                              <Badge key={oIdx} variant="secondary" className="text-[10px] bg-slate-100 text-slate-700">
                                {opt}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          {q.indicator && <span>Indicator: {q.indicator}</span>}
                          {q.kpi && <span>KPI: {q.kpi}</span>}
                        </div>
                      </div>

                      {/* Right: Actions (required toggle and delete) */}
                      <div className="flex flex-col justify-between items-end shrink-0 gap-3 border-l pl-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`req-${q.id}`}
                            checked={q.isRequired}
                            onCheckedChange={(val) => handleToggleRequired(idx, !!val)}
                          />
                          <Label htmlFor={`req-${q.id}`} className="text-xs font-normal cursor-pointer select-none">
                            Required
                          </Label>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive hover:bg-destructive/5"
                          onClick={() => handleRemoveQuestion(idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    disabled={addableQuestions.length === 0}
                    onClick={() => setIsAddDialogOpen(true)}
                  >
                    <Plus className="size-4" />
                    Add Question from Bank
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSaveSurveyDraft}
                      disabled={saveStatus === "saving"}
                      className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Save className="size-4" />
                      {saveStatus === "saving" ? "Saving..." : "Save Draft"}
                    </Button>
                    {saveStatus === "success" && (
                      <span className="text-xs text-emerald-600 font-medium">Draft saved successfully!</span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-xs text-destructive font-medium">Failed to save draft.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add question from bank dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Question from Bank</DialogTitle>
            <DialogDescription>
              Select an additional question from the approved question bank methodology under the &ldquo;{study.domain}&rdquo; domain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankQuestion">Available Questions</Label>
              <Select value={selectedBankQuestionId} onValueChange={setSelectedBankQuestionId}>
                <SelectTrigger id="bankQuestion" className="w-full">
                  <SelectValue placeholder="Select a question" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {addableQuestions.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      [{q.questionId}] {q.questionText.length > 60 ? `${q.questionText.slice(0, 60)}...` : q.questionText}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddQuestion} disabled={!selectedBankQuestionId}>
              Add to Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
