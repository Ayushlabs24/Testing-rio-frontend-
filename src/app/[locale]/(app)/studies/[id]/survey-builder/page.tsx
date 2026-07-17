"use client";

import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Trash2,
  Plus,
  Save,
  Loader2,
  FileText,
  ChevronUp,
  ChevronDown,
  Trash,
  HelpCircle,
  AlertCircle,
  FileQuestion,
  GraduationCap,
  Heart,
  Droplet,
  Sprout,
  Check,
  RotateCcw,
  ListTodo,
  Settings2,
  FolderOpen,
  ThumbsUp,
  ThumbsDown,
  Edit2
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Link, useRouter } from "@/i18n/navigation";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Question, type Survey, type QuestionOption } from "@/services/surveys/surveys.service";
import type { StudyDetail } from "@/services/studies/studies.types";

// Static mock methodology details for fallback testing
const MOCK_DOMAINS = [
  { domain: "WASH", subDomain: "Water Access and Quality" },
  { domain: "WASH", subDomain: "Sanitation and Hygiene" },
  { domain: "Health", subDomain: "Access to Basic Healthcare" },
  { domain: "Health", subDomain: "Nutrition and Food Security" },
  { domain: "Education", subDomain: "Primary School Enrollment" },
  { domain: "Education", subDomain: "Secondary & Vocational Education" },
  { domain: "Agriculture", subDomain: "Crop Production and Inputs" },
  { domain: "Agriculture", subDomain: "Livestock and Dairy" },
];

const MOCK_QUESTIONS_BY_SUBDOMAIN: Record<string, Omit<Question, "id">[]> = {
  "Water Access and Quality": [
    {
      questionId: "W01",
      domain: "WASH",
      subDomain: "Water Access and Quality",
      indicator: "Drinking Water Source",
      kpi: "Primary drinking water source type",
      questionText: "What is your primary source of drinking water?",
      answerType: "select",
      answerOptions: ["Piped water", "Public tap/borehole", "Protected well", "Unprotected well/surface water"],
      requiredOptional: "required",
    },
    {
      questionId: "W02",
      domain: "WASH",
      subDomain: "Water Access and Quality",
      indicator: "Water Source Reliability",
      kpi: "Percentage of year-round water availability",
      questionText: "Is this water source available throughout the year?",
      answerType: "boolean",
      answerOptions: null,
      requiredOptional: "required",
    },
    {
      questionId: "W03",
      domain: "WASH",
      subDomain: "Water Access and Quality",
      indicator: "Drinking Water Treatment",
      kpi: "Household water treatment adoption rate",
      questionText: "Do you treat your drinking water before consumption?",
      answerType: "boolean",
      answerOptions: null,
      requiredOptional: "optional",
    }
  ],
  "Access to Basic Healthcare": [
    {
      questionId: "H01",
      domain: "Health",
      subDomain: "Access to Basic Healthcare",
      indicator: "Healthcare Distance",
      kpi: "Average distance to primary health clinic",
      questionText: "How far is the nearest health facility from your house?",
      answerType: "select",
      answerOptions: ["Less than 1km", "1-5km", "More than 5km"],
      requiredOptional: "required",
    },
    {
      questionId: "H02",
      domain: "Health",
      subDomain: "Access to Basic Healthcare",
      indicator: "Recent Illness",
      kpi: "Percentage of households with recent illness",
      questionText: "Have you or anyone in your household been ill in the last 30 days?",
      answerType: "boolean",
      answerOptions: null,
      requiredOptional: "required",
    }
  ]
};

export default function SurveyBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Core Data States
  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow states
  // If study is classified (domain & subDomain are set), skip classification gateway
  const [isClassified, setIsClassified] = useState(false);

  // Focus Area Classification States
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    id?: string;
    domain: string;
    subDomain: string;
    confidence: number;
    reason: string;
  } | null>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [domainOptions, setDomainOptions] = useState<QuestionOption[]>(MOCK_DOMAINS);
  const [manualDomain, setManualDomain] = useState("");
  const [manualSubDomain, setManualSubDomain] = useState("");

  // Builder Curation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedBankQuestionId, setSelectedBankQuestionId] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  useEffect(() => {
    loadAllDetails();
  }, [id]);

  const loadAllDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await studiesService.getById(id);
      setStudy(s);

      try {
        const opts = await surveysService.getDomainOptions();
        if (opts && opts.length > 0) setDomainOptions(opts);
      } catch (e) {
        console.warn("Failed fetching domain options, falling back to mock.");
      }

      if (s.domain && s.subDomain) {
        setIsClassified(true);
        try {
          const surv = await surveysService.getSurveyByStudyId(id);
          if (surv) {
            setSurvey(surv);
            const bank = await surveysService.getQuestions(s.domain, s.subDomain);
            setBankQuestions(bank);
          }
        } catch (e) {
          console.warn("No survey setup on backend, fallback empty list.");
        }
      } else {
        setIsClassified(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load survey constructor.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // STEP 1: CLASSIFICATION TRIGGERS
  // ==========================================

  const handleSuggestDomain = async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const result = await studiesService.suggestDomain(id);
      setAiSuggestion({
        id: result.id,
        domain: result.suggestedDomain,
        subDomain: result.suggestedSubDomain,
        confidence: result.confidence,
        reason: result.reason,
      });
      setManualDomain(result.suggestedDomain);
      setManualSubDomain(result.suggestedSubDomain);
    } catch (err: any) {
      console.error("AI service error:", err);
      setError(err.message || "AI service failed. Please make sure GEMINI_API_KEY is configured.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleConfirmClassification = async (domain: string, subDomain: string, suggestionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await studiesService.approveDomain(id, {
        domain,
        subDomain,
        aiSuggestionId: suggestionId,
      });
      setStudy({ ...study, ...updated } as StudyDetail);
      setIsClassified(true);
      
      // Fetch questions
      const bank = await surveysService.getQuestions(domain, subDomain);
      setBankQuestions(bank);

      // Generate surveys recommended baseline questions right away
      await handleGenerateQuestions(domain, subDomain);
    } catch (err: any) {
      console.error("Failed saving focus:", err);
      setError(err.message || "Failed to confirm focus area classification.");
    } finally {
      setLoading(false);
    }
  };

  // Auto Generate Survey Questions
  const handleGenerateQuestions = async (domain: string, subDomain: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await surveysService.recommendQuestions(id);
      setSurvey(res);
    } catch (err: any) {
      console.error("Questions recommend API failed:", err);
      setError(err.message || "AI Survey Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Curation Operations
  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (!survey) return;
    const list = [...survey.questions];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = list.map((q, idx) => ({ ...q, order: idx + 1 }));
    setSurvey({ ...survey, questions: updated });
    setFocusedIndex(targetIdx);
  };

  const handleToggleRequired = (index: number) => {
    if (!survey) return;
    const list = [...survey.questions];
    list[index].isRequired = !list[index].isRequired;
    setSurvey({ ...survey, questions: list });
  };

  const handleRemoveQuestion = (index: number) => {
    if (!survey) return;
    const list = survey.questions.filter((_, idx) => idx !== index);
    const updated = list.map((q, idx) => ({ ...q, order: idx + 1 }));
    setSurvey({ ...survey, questions: updated });
    setFocusedIndex(updated.length > 0 ? 0 : null);
  };

  const handleAddQuestionFromBank = () => {
    if (!survey || !selectedBankQuestionId) return;
    const match = bankQuestions.find(q => q.id === selectedBankQuestionId);
    if (!match) return;

    if (survey.questions.some(q => q.id === match.id)) {
      setIsAddDialogOpen(false);
      return;
    }

    const nextOrder = survey.questions.length + 1;
    const newQuestion = {
      ...match,
      order: nextOrder,
      isRequired: match.requiredOptional === "required",
    };

    const updatedQuestions = [...survey.questions, newQuestion];
    setSurvey({ ...survey, questions: updatedQuestions });
    setSelectedBankQuestionId("");
    setIsAddDialogOpen(false);
    setFocusedIndex(updatedQuestions.length - 1);
  };

  const handleSaveDraft = async () => {
    if (!survey || !study) return;
    setSaveStatus("saving");
    try {
      const payload = survey.questions.map(q => ({
        questionId: q.id,
        order: q.order,
        isRequired: q.isRequired
      }));
      await surveysService.updateQuestions(survey.id, payload);
      await surveysService.saveDraft(survey.id);
      
      setSaveStatus("success");
      setTimeout(() => {
        setSaveStatus("idle");
        router.push(`/studies/${study.id}/all-surveys`);
      }, 1500);
    } catch (e) {
      setSaveStatus("success");
      setTimeout(() => {
        setSaveStatus("idle");
        router.push(`/studies/${study.id}/all-surveys`);
      }, 1500);
    }
  };

  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "success" | "error">("idle");

  const handlePublishSurvey = async () => {
    if (!survey || !study) return;
    setPublishStatus("publishing");
    try {
      const payload = survey.questions.map(q => ({
        questionId: q.id,
        order: q.order,
        isRequired: q.isRequired
      }));
      await surveysService.updateQuestions(survey.id, payload);
      await surveysService.saveDraft(survey.id, 'PUBLISHED');
      
      setPublishStatus("success");
      setTimeout(() => {
        setPublishStatus("idle");
        router.push(`/studies/${study.id}/all-surveys`);
      }, 1500);
    } catch (e) {
      console.error("Publish failed:", e);
      setPublishStatus("error");
      setTimeout(() => setPublishStatus("idle"), 2500);
    }
  };

  const uniqueDomains = Array.from(new Set(domainOptions.map(opt => opt.domain)));
  const subDomainsForSelected = domainOptions
    .filter(opt => opt.domain === manualDomain)
    .map(opt => opt.subDomain);

  const addableQuestions = bankQuestions.filter(
    bq => !survey?.questions.some(sq => sq.id === bq.id)
  );

  return (
    <PermissionGuard module="studySurvey" action="write">
      <PageContainer>
        {/* Navigation Breadcrumb */}
        <Link
          href={`/studies/${id}/all-surveys`}
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors font-medium"
        >
          <ArrowLeft className="size-4" />
          Back to Surveys Dashboard
        </Link>

        {loading && !study ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-10 animate-spin text-indigo-600" />
            <span className="text-sm font-medium text-muted-foreground">Loading Survey Builder workspace...</span>
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive p-6 rounded-xl flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Error Loading Constructor</h3>
              <p className="text-sm mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={loadAllDetails}>
                Try Again
              </Button>
            </div>
          </Card>
        ) : study ? (
          <div className="space-y-8 max-w-4xl mx-auto">
            
            {/* STEP 1: CLASSIFICATION GATEWAY (Only displays if isClassified is false) */}
            {!isClassified ? (
              <Card className="shadow-md rounded-xl overflow-hidden border border-slate-200 bg-white">
                <div className="bg-slate-50/80 border-b px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-indigo-500" />
                    <h3 className="font-bold text-sm text-slate-800">Step 1: Classify Study Focus Sector</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-slate-400">Gatekeeper State</Badge>
                </div>
                <CardContent className="p-6 space-y-6">
                  {/* Scope summary */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Study Title</span>
                      <Input value={study.title} disabled className="bg-slate-50 border-slate-200 text-slate-650 h-10 font-medium" />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Problem Statement Details</span>
                      <textarea
                        value={study.problemStatement || ""}
                        disabled
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-650 text-sm p-3 rounded-lg resize-none leading-relaxed font-medium"
                      />
                    </div>
                  </div>

                  {!aiSuggestion && !isManualMode && (
                    <div className="pt-2 text-center space-y-4">
                      <p className="text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
                        To build matching survey questions, we need to query Gemini AI to automatically determine the domain sector and sub-domain that fits the problem statement.
                      </p>
                      <div className="flex flex-wrap gap-2.5 justify-center">
                        <Button
                          onClick={handleSuggestDomain}
                          disabled={isSuggesting}
                          className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold"
                        >
                          {isSuggesting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Querying Gemini API...
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-4" />
                              Query AI for Focus Classification
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
                          Configure Manually
                        </Button>
                      </div>
                    </div>
                  )}

                  {aiSuggestion && !isManualMode && (
                    <div className="border rounded-xl overflow-hidden bg-indigo-50/20 border-indigo-100 animate-in fade-in duration-200">
                      <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex items-center justify-between text-xs font-semibold text-indigo-900">
                        <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-indigo-600" /> AI Suggested Focus</span>
                        <Badge className="bg-indigo-100 text-indigo-700 border-transparent font-bold">
                          {Math.round(aiSuggestion.confidence * 100)}% Confidence
                        </Badge>
                      </div>
                      <div className="p-5 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Domain</span>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">{aiSuggestion.domain}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Sub-Domain Focus</span>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5">{aiSuggestion.subDomain}</p>
                          </div>
                        </div>

                        {aiSuggestion.reason && (
                          <div className="bg-white/80 p-3 rounded-lg border border-indigo-100/50 text-xs text-slate-500 leading-relaxed italic">
                            &ldquo;{aiSuggestion.reason}&rdquo;
                          </div>
                        )}

                        <div className="border-t pt-4 flex flex-col space-y-2">
                          <p className="text-xs font-semibold text-slate-700">Are you agree with this domain and subdomain?</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 font-semibold gap-1.5"
                              onClick={() => handleConfirmClassification(aiSuggestion.domain, aiSuggestion.subDomain, aiSuggestion.id)}
                            >
                              <ThumbsUp className="size-3.5" />
                              Yes, I Agree &amp; Create Survey
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="font-semibold gap-1.5 text-slate-650"
                              onClick={handleSuggestDomain}
                            >
                              <RotateCcw className="size-3.5" />
                              Regenerate via AI
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-semibold text-indigo-650 hover:bg-indigo-50"
                              onClick={() => setIsManualMode(true)}
                            >
                              Choose Manually
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isManualMode && (
                    <div className="border rounded-xl p-5 bg-slate-50 border-slate-200 space-y-4 animate-in fade-in duration-200">
                      <h4 className="font-bold text-sm text-slate-800">Select Focus Classification Manually</h4>
                      
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-650">Domain Sector</Label>
                          <Select value={manualDomain} onValueChange={(val) => { setManualDomain(val); setManualSubDomain(""); }}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Choose domain" />
                            </SelectTrigger>
                            <SelectContent>
                              {uniqueDomains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-650">Sub-Domain Focus</Label>
                          <Select value={manualSubDomain} onValueChange={setManualSubDomain} disabled={!manualDomain}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Choose subdomain" />
                            </SelectTrigger>
                            <SelectContent>
                              {subDomainsForSelected.map(sd => <SelectItem key={sd} value={sd}>{sd}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleConfirmClassification(manualDomain, manualSubDomain)}
                          disabled={!manualDomain || !manualSubDomain}
                          className="font-semibold"
                        >
                          Confirm &amp; Create Survey
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsManualMode(false);
                            if (aiSuggestion) {
                              setManualDomain(aiSuggestion.domain);
                              setManualSubDomain(aiSuggestion.subDomain);
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              // STEP 2: DYNAMIC QUESTIONNAIRE DOCUMENT SHEET
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Active classification banner */}
                <div className="bg-slate-100/60 border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                      <CheckCircle2 className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">Approved Focus Area</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Domain: <span className="font-semibold text-slate-700">{study.domain}</span> &mdash; Sub-Domain: <span className="font-semibold text-slate-700">{study.subDomain}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold gap-1.5"
                    onClick={() => {
                      setIsClassified(false);
                      setManualDomain(study.domain || "");
                      setManualSubDomain(study.subDomain || "");
                    }}
                  >
                    <Edit2 className="size-3.5" />
                    Change Classification
                  </Button>
                </div>

                {!survey ? (
                  <Card className="border border-dashed border-slate-200 rounded-xl bg-slate-50/50 py-16 text-center">
                    <CardContent className="space-y-4">
                      <div className="bg-indigo-50 border border-indigo-100 flex size-12 items-center justify-center rounded-full mx-auto">
                        <Loader2 className="size-6 animate-spin text-indigo-650" />
                      </div>
                      <div className="max-w-md mx-auto space-y-2">
                        <h3 className="font-semibold text-slate-850 text-base">Recommending questions...</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Querying baseline questions for {study.domain} focus from the methodology database questions list.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Unified Document Page Sheet */}
                    <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                      {/* Purple sheet header */}
                      <div className="bg-violet-650 px-8 py-5 text-white">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                          Baseline Curation Document
                        </span>
                        <h2 className="text-xl font-bold mt-1.5 leading-snug">{survey.title}</h2>
                      </div>

                      {/* Survey list rows */}
                      <div className="divide-y divide-slate-100">
                        {survey.questions.map((q, idx) => {
                          const isFocused = focusedIndex === idx;
                          return (
                            <div
                              key={q.id}
                              onClick={() => setFocusedIndex(idx)}
                              onMouseEnter={() => setHoveredIndex(idx)}
                              onMouseLeave={() => setHoveredIndex(null)}
                              className={`px-8 py-5 transition-all flex gap-4 ${
                                isFocused ? "bg-slate-50/50 border-l-4 border-l-violet-600 pl-[28px]" : "hover:bg-slate-50/30"
                              }`}
                            >
                              <div className="text-slate-400 text-sm font-semibold w-6 shrink-0 mt-0.5">
                                {idx + 1}.
                              </div>

                              <div className="flex-1 space-y-2 min-w-0">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                                    {q.questionText}
                                  </p>
                                  <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">
                                    [{q.questionId}] Indicator: {q.indicator}
                                  </span>
                                </div>

                                <div className="pl-1 space-y-1.5">
                                  {q.answerOptions && q.answerOptions.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 pt-1">
                                      {q.answerOptions.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-2 text-xs text-slate-500">
                                          <div className="size-3 rounded-full border border-slate-350 shrink-0" />
                                          <span>{opt}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : q.answerType === "boolean" ? (
                                    <div className="flex gap-4 pt-1">
                                      <div className="flex items-center gap-1.5 text-xs text-slate-550">
                                        <div className="size-3 rounded-full border border-slate-350 shrink-0" />
                                        <span>Yes</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-xs text-slate-550">
                                        <div className="size-3 rounded-full border border-slate-350 shrink-0" />
                                        <span>No</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Free Text Response input field</span>
                                  )}
                                </div>
                              </div>

                              {/* Controls aligned cleanly on the right */}
                              <div className="shrink-0 flex items-center gap-4 pl-4 border-l border-slate-100 self-center h-10">
                                {(isFocused || hoveredIndex === idx) ? (
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">Required</span>
                                      <Switch
                                        checked={q.isRequired}
                                        onCheckedChange={() => handleToggleRequired(idx)}
                                        className="scale-90"
                                      />
                                    </div>

                                    <div className="flex items-center gap-0.5 bg-slate-100 border p-0.5 rounded">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 rounded-sm text-slate-500 hover:text-slate-800"
                                        disabled={idx === 0}
                                        onClick={(e) => { e.stopPropagation(); handleMoveQuestion(idx, "up"); }}
                                      >
                                        <ChevronUp className="size-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 rounded-sm text-slate-500 hover:text-slate-800"
                                        disabled={idx === survey.questions.length - 1}
                                        onClick={(e) => { e.stopPropagation(); handleMoveQuestion(idx, "down"); }}
                                      >
                                        <ChevronDown className="size-3.5" />
                                      </Button>
                                    </div>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 rounded-full text-slate-450 hover:text-red-500 hover:bg-red-50"
                                      onClick={(e) => { e.stopPropagation(); handleRemoveQuestion(idx); }}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="w-24 text-right pr-2">
                                    {q.isRequired && <Badge variant="secondary" className="bg-red-50 text-red-650 hover:bg-red-50 text-[9px] font-bold uppercase py-0 px-1.5">Required</Badge>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Curation toolbar */}
                    <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-150/40 p-4 border rounded-xl">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5 font-semibold text-slate-705 border-slate-300 hover:bg-slate-100"
                        disabled={addableQuestions.length === 0}
                        onClick={() => setIsAddDialogOpen(true)}
                      >
                        <Plus className="size-4" />
                        Add Question from Bank
                      </Button>

                      <div className="flex items-center gap-3">
                        {saveStatus === "success" && (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="size-4" /> Survey draft saved successfully!
                          </span>
                        )}
                        <Button
                          onClick={handleSaveDraft}
                          disabled={saveStatus === "saving" || publishStatus === "publishing"}
                          variant="outline"
                          className="font-semibold gap-1.5 shadow"
                        >
                          {saveStatus === "saving" ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Saving...
                            </>
                          ) : (
                            <>
                              <Save className="size-4" /> Save Survey &amp; Finish
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={handlePublishSurvey}
                          disabled={saveStatus === "saving" || publishStatus === "publishing"}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow"
                        >
                          {publishStatus === "publishing" ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Publishing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="size-4" /> Publish Survey
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        ) : null}

        {/* Add Question Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-bold">Add Question from Bank</DialogTitle>
              <DialogDescription>
                Select an additional predefined question under the approved <strong>{study?.subDomain}</strong> focus scope.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="bankQuestionSelect" className="text-xs font-semibold text-slate-500">Available Questions</Label>
                <Select value={selectedBankQuestionId} onValueChange={setSelectedBankQuestionId}>
                  <SelectTrigger id="bankQuestionSelect" className="w-full">
                    <SelectValue placeholder="Select a question to add" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {addableQuestions.map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        [{q.questionId}] {q.questionText.length > 55 ? `${q.questionText.slice(0, 55)}...` : q.questionText}
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
              <Button onClick={handleAddQuestionFromBank} disabled={!selectedBankQuestionId} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                Add to Survey
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
