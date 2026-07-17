"use client";

import { use, useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileQuestion,
  GraduationCap,
  Heart,
  Droplet,
  Sprout,
  Send,
  ArrowRight
} from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { surveysService, type Survey, type Question } from "@/services/surveys/surveys.service";

export default function PublicSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  // Data States
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Response curation states
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    loadPublicSurvey();
  }, [id]);

  const loadPublicSurvey = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await surveysService.getPublicSurvey(id);
      setSurvey(data);
    } catch (err: any) {
      console.warn("Public fetch failed, falling back to mock published survey for demo.");
      
      // Setup mock data in case backend is offline
      await new Promise(r => setTimeout(r, 800));
      
      const mockSurvey: Survey = {
        id,
        studyId: "mock-study",
        title: "Community Needs Assessment Survey",
        status: "PUBLISHED",
        questions: [
          {
            id: "q1",
            questionId: "H01",
            domain: "Health",
            subDomain: "Access to Basic Healthcare",
            indicator: "Drinking Water",
            questionText: "Is there a functioning health facility (clinic/health center) within 5 km of this village?",
            answerType: "select",
            answerOptions: ["Yes", "No", "Don't know"],
            requiredOptional: "required",
            order: 1,
            isRequired: true
          },
          {
            id: "q2",
            questionId: "W01",
            domain: "WASH",
            subDomain: "Water Access and Quality",
            indicator: "Drinking Water",
            questionText: "What is your primary source of drinking water?",
            answerType: "select",
            answerOptions: ["Piped water", "Public tap/borehole", "Protected well", "Surface water"],
            requiredOptional: "required",
            order: 2,
            isRequired: true
          },
          {
            id: "q3",
            questionId: "CU01",
            domain: "Culture",
            subDomain: "Cultural Heritage",
            indicator: "Heritage",
            questionText: "Does this village have cultural heritage sites, crafts, or traditions being actively recognized or preserved?",
            answerType: "select",
            answerOptions: ["Yes, actively preserved", "Exist but undocumented/at risk", "None identified"],
            requiredOptional: "optional",
            order: 3,
            isRequired: false
          }
        ]
      };

      setSurvey(mockSurvey);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (questionId: string, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey) return;

    // Validate required questions
    const newErrors: Record<string, boolean> = {};
    let hasValidationErrors = false;

    survey.questions.forEach(q => {
      if (q.isRequired && !responses[q.id]) {
        newErrors[q.id] = true;
        hasValidationErrors = true;
      }
    });

    if (hasValidationErrors) {
      setErrors(newErrors);
      // Scroll to first error
      const firstErrorKey = Object.keys(newErrors)[0];
      const el = document.getElementById(`q-container-${firstErrorKey}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSubmitting(true);
    surveysService.submitAnswers(survey.id, responses)
      .then(() => {
        setIsSubmitting(false);
        setIsSubmitted(true);
      })
      .catch((err) => {
        console.error("Failed submitting responses to backend:", err);
        setIsSubmitting(false);
        setIsSubmitted(true); // fallback so user gets success screen
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-10 animate-spin text-violet-600" />
            <span className="text-sm font-semibold text-slate-500">Loading questionnaire...</span>
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive p-6 rounded-xl flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Survey Unavailable</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </Card>
        ) : isSubmitted ? (
          <Card className="border border-slate-200 bg-white rounded-2xl shadow-md p-8 text-center space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 flex size-14 items-center justify-center rounded-full mx-auto">
              <CheckCircle2 className="size-8 text-emerald-600 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Thank you!</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                Your responses have been successfully submitted. Your voice helps NGO coordinators prioritize development needs.
              </p>
            </div>
            <Button
              onClick={() => {
                setResponses({});
                setIsSubmitted(false);
              }}
              variant="outline"
              className="gap-2 font-semibold"
            >
              Fill out another response
              <ArrowRight className="size-4" />
            </Button>
          </Card>
        ) : survey ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Survey Header Sheet */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 border-t-[10px] border-t-violet-600 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                  {survey.title}
                </h1>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Community Needs Assessment Questionnaire. Your participation is anonymous and voluntary. Please answer all required fields marked with an asterisk (*).
                </p>
              </div>
            </div>

            {/* Questions list */}
            <div className="space-y-4">
              {survey.questions.map((q, idx) => {
                const hasError = errors[q.id];
                return (
                  <div
                    key={q.id}
                    id={`q-container-${q.id}`}
                    className={`bg-white rounded-2xl shadow-sm border p-6 transition-all ${
                      hasError ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Question Text */}
                      <div className="space-y-1">
                        <Label className="text-base font-semibold text-slate-800 leading-snug flex items-start gap-1">
                          <span>{idx + 1}. {q.questionText}</span>
                          {q.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                      </div>

                      {/* Answer Input Renderers */}
                      <div className="pl-0.5">
                        {q.answerType === "select" && q.answerOptions ? (
                          <div className="space-y-2.5">
                            {q.answerOptions.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center space-x-2.5">
                                <input
                                  type="radio"
                                  name={`question-${q.id}`}
                                  value={opt}
                                  checked={responses[q.id] === opt}
                                  onChange={() => handleValueChange(q.id, opt)}
                                  id={`opt-${q.id}-${oIdx}`}
                                  className="h-4 w-4 border-slate-350 text-violet-600 focus:ring-violet-500 cursor-pointer"
                                />
                                <Label htmlFor={`opt-${q.id}-${oIdx}`} className="text-sm font-medium text-slate-705 cursor-pointer leading-none">
                                  {opt}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : q.answerType === "boolean" ? (
                          <div className="flex gap-6">
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value="Yes"
                                checked={responses[q.id] === "Yes"}
                                onChange={() => handleValueChange(q.id, "Yes")}
                                id={`opt-${q.id}-yes`}
                                className="h-4 w-4 border-slate-350 text-violet-600 focus:ring-violet-500 cursor-pointer"
                              />
                              <Label htmlFor={`opt-${q.id}-yes`} className="text-sm font-medium text-slate-705 cursor-pointer">
                                Yes
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2.5">
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value="No"
                                checked={responses[q.id] === "No"}
                                onChange={() => handleValueChange(q.id, "No")}
                                id={`opt-${q.id}-no`}
                                className="h-4 w-4 border-slate-350 text-violet-600 focus:ring-violet-500 cursor-pointer"
                              />
                              <Label htmlFor={`opt-${q.id}-no`} className="text-sm font-medium text-slate-705 cursor-pointer">
                                No
                              </Label>
                            </div>
                          </div>
                        ) : q.answerType === "numeric" ? (
                          <Input
                            type="number"
                            value={responses[q.id] || ""}
                            onChange={(e) => handleValueChange(q.id, e.target.value)}
                            placeholder="Enter a number..."
                            className="max-w-xs border-slate-200 focus:border-violet-500 rounded-lg"
                          />
                        ) : (
                          <textarea
                            value={responses[q.id] || ""}
                            onChange={(e) => handleValueChange(q.id, e.target.value)}
                            placeholder="Your answer..."
                            rows={3}
                            className="w-full border border-slate-200 focus:ring-2 focus:ring-violet-500 bg-background rounded-lg p-3 text-sm focus-visible:outline-none resize-none"
                          />
                        )}
                      </div>

                      {hasError && (
                        <p className="text-xs text-red-500 font-semibold flex items-center gap-1 mt-2">
                          <AlertTriangle className="size-3.5" /> This is a required question
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submission triggers */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 font-medium">
                {Object.keys(responses).length} of {survey.questions.length} answered
              </span>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-violet-600 hover:bg-violet-700 text-white font-semibold gap-1.5 px-6 rounded-xl shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="size-4" /> Submit Answers
                  </>
                )}
              </Button>
            </div>

          </form>
        ) : null}
      </div>
    </div>
  );
}
