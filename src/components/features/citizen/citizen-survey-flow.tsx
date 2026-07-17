"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { citizenService } from "@/services/citizen/citizen.service";
import type { ResolvedSurvey } from "@/services/citizen/citizen.types";
import { ApiError } from "@/services/api/types";

type LoadState = "loading" | "notFound" | "ready";
// "welcome" carries the study/organisation context that used to live on its
// own post-OTP screen — showing it up front (before asking for any personal
// details) is what the redesign asked for.
type Phase = "welcome" | "details" | "otp" | "questions" | "review";
type TerminalPhase = "submitting" | "submitted";

/** Mobile-first full-page shell — no theme toggle, no logo, no app-shell
 * chrome. Citizens reach this by scanning a QR code on their phone; the
 * only thing on screen should be the survey itself. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen justify-center">
      <div className="flex w-full max-w-md flex-col px-5 py-8 sm:py-12">{children}</div>
    </div>
  );
}

function ProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="mb-6 space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("citizen.survey");
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground mb-4 -ml-1 inline-flex h-9 items-center gap-1.5 rounded-md px-1 text-sm"
    >
      <ArrowLeft className="size-3.5" />
      {t("back")}
    </button>
  );
}

function ScaleStars({ value, max }: { value: number; max: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={
            i < value
              ? "fill-primary text-primary size-4"
              : "text-muted-foreground size-4"
          }
        />
      ))}
    </div>
  );
}

export function CitizenSurveyFlow({ token }: { token: string }) {
  const t = useTranslations("citizen.survey");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [survey, setSurvey] = useState<ResolvedSurvey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("welcome");
  const [terminal, setTerminal] = useState<TerminalPhase | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    citizenService
      .resolveSurvey(token)
      .then((resolved) => {
        setSurvey(resolved);
        setLoadState("ready");
      })
      .catch(() => setLoadState("notFound"));
  }, [token]);

  const questions = survey?.questions ?? [];

  // Fixed steps (details, otp) + one step per question + review.
  const totalSteps = 2 + questions.length + 1;
  const currentStepNumber = useMemo(() => {
    if (phase === "details") return 1;
    if (phase === "otp") return 2;
    if (phase === "questions") return 2 + questionIndex + 1;
    return totalSteps;
  }, [phase, questionIndex, totalSteps]);

  // Duplicate submission is checked as soon as the participant provides
  // their contact details — before any OTP challenge (or any other record)
  // is created. Nothing is persisted until the final Submit.
  async function submitDetails() {
    setSubmitting(true);
    setError(null);
    try {
      const { isDuplicate } = await citizenService.checkDuplicate(token, { contact });
      if (isDuplicate) {
        setError(t("details.duplicateError"));
        return;
      }
      const result = await citizenService.requestOtp(token, { contact });
      setChallengeId(result.challengeId);
      setPhase("otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp() {
    if (!challengeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await citizenService.verifyOtp(token, { challengeId, code });
      setQuestionIndex(0);
      setPhase("questions");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  function goToNextQuestion() {
    const question = questions[questionIndex];
    if (question.required && !answers[question.code]?.trim()) {
      setError(t("form.requiredError"));
      return;
    }
    setError(null);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setPhase("review");
    }
  }

  function goBackFromQuestion() {
    setError(null);
    if (questionIndex === 0) {
      setPhase("otp");
    } else {
      setQuestionIndex(questionIndex - 1);
    }
  }

  function jumpToQuestion(index: number) {
    setError(null);
    setQuestionIndex(index);
    setPhase("questions");
  }

  async function submitSurvey() {
    if (!challengeId) return;
    setSubmitting(true);
    setTerminal("submitting");
    setError(null);
    try {
      await citizenService.submitResponse(token, {
        challengeId,
        contactName: name || undefined,
        answers,
      });
      setTerminal("submitted");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
      setTerminal(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <Shell>
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 text-sm">
          <Loader2 className="size-6 animate-spin" />
          {t("loading")}
        </div>
      </Shell>
    );
  }

  if (loadState === "notFound" || !survey) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <h1 className="text-foreground text-lg font-semibold">{t("notFoundTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("notFoundDescription")}</p>
        </div>
      </Shell>
    );
  }

  if (terminal === "submitting" || terminal === "submitted") {
    if (terminal === "submitting") {
      return (
        <Shell>
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 text-sm">
            <Loader2 className="size-6 animate-spin" />
            {t("review.submitting")}
          </div>
        </Shell>
      );
    }
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="bg-badge-success flex size-14 items-center justify-center rounded-full">
            <CheckCircle2 className="text-badge-success-foreground size-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-foreground text-xl font-semibold">
              {t("submitted.title")}
            </h1>
            <p className="text-muted-foreground text-sm text-balance">
              {t("submitted.description")}
            </p>
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={() => window.close()}>
            {t("submitted.done")}
          </Button>
        </div>
      </Shell>
    );
  }

  if (phase === "welcome") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col justify-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-foreground text-2xl font-semibold text-balance">
              {survey.studyTitle}
            </h1>
            {survey.organizationName ? (
              <p className="text-muted-foreground text-sm">
                {t("welcome.conductedBy")}{" "}
                <span className="text-foreground font-medium">
                  {survey.organizationName}
                </span>
              </p>
            ) : null}
            <p className="text-muted-foreground text-sm">{t("welcome.description")}</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-full">
                  <Clock className="text-primary size-4.5" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {t("welcome.estimatedTimeValue", {
                      minutes: survey.estimatedMinutes,
                    })}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("welcome.estimatedTimeLabel")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-full">
                  <ClipboardList className="text-primary size-4.5" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {t("welcome.questionCountValue", { count: survey.questionCount })}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("welcome.questionCountLabel")}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-full">
                  <ShieldCheck className="text-primary size-4.5" />
                </div>
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {t("welcome.oneResponseLabel")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("welcome.oneResponseNote")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button className="w-full" size="lg" onClick={() => setPhase("details")}>
            {t("welcome.start")}
          </Button>
        </div>
      </Shell>
    );
  }

  if (phase === "details") {
    return (
      <Shell>
        <ProgressBar
          current={currentStepNumber}
          total={totalSteps}
          label={t("progressLabel", { current: currentStepNumber, total: totalSteps })}
        />
        <BackButton onClick={() => setPhase("welcome")} />
        <div className="flex-1 space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-foreground text-lg font-semibold">
              {t("details.title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("details.description")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-name">{t("details.nameLabel")}</Label>
            <Input
              id="citizen-name"
              value={name}
              placeholder={t("details.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-contact">{t("details.emailLabel")}</Label>
            <Input
              id="citizen-contact"
              type="email"
              value={contact}
              placeholder={t("details.emailPlaceholder")}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={submitting || !contact || !name}
          onClick={submitDetails}
        >
          {submitting ? t("details.submitting") : t("details.submit")}
        </Button>
      </Shell>
    );
  }

  if (phase === "otp") {
    return (
      <Shell>
        <ProgressBar
          current={currentStepNumber}
          total={totalSteps}
          label={t("progressLabel", { current: currentStepNumber, total: totalSteps })}
        />
        <BackButton onClick={() => setPhase("details")} />
        <div className="flex-1 space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-foreground text-lg font-semibold">{t("otp.title")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("otp.description", { contact })}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-otp">{t("otp.codeLabel")}</Label>
            <Input
              id="citizen-otp"
              inputMode="numeric"
              maxLength={8}
              placeholder={t("otp.codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={submitting || !code}
          onClick={submitOtp}
        >
          {submitting ? t("otp.submitting") : t("otp.submit")}
        </Button>
      </Shell>
    );
  }

  if (phase === "questions") {
    const question = questions[questionIndex];
    return (
      <Shell>
        <ProgressBar
          current={questionIndex + 1}
          total={questions.length}
          label={t("form.questionOf", {
            current: questionIndex + 1,
            total: questions.length,
          })}
        />
        <BackButton onClick={goBackFromQuestion} />
        <div className="flex-1 space-y-4">
          <div className="space-y-3">
            <Label className="text-foreground text-lg leading-snug font-semibold">
              {question.text}
              {question.required ? (
                <span className="text-destructive ml-1">{t("form.requiredMark")}</span>
              ) : null}
            </Label>
            {question.type === "scale" || question.type === "single_choice" ? (
              <div className="flex flex-wrap gap-2">
                {question.options?.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="default"
                    variant={answers[question.code] === option ? "default" : "outline"}
                    onClick={() => setAnswers({ ...answers, [question.code]: option })}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            ) : (
              <Textarea
                className="min-h-32"
                value={answers[question.code] ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [question.code]: e.target.value })
                }
              />
            )}
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <Button className="mt-6 w-full" size="lg" onClick={goToNextQuestion}>
          {t("form.next")}
        </Button>
      </Shell>
    );
  }

  // phase === "review"
  return (
    <Shell>
      <ProgressBar
        current={currentStepNumber}
        total={totalSteps}
        label={t("progressLabel", { current: currentStepNumber, total: totalSteps })}
      />
      <BackButton
        onClick={() => {
          setQuestionIndex(questions.length - 1);
          setPhase("questions");
        }}
      />
      <div className="flex-1 space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-foreground text-lg font-semibold">{t("review.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("review.description")}</p>
        </div>
        <div className="divide-border divide-y">
          {questions.map((question, index) => {
            const rawAnswer = answers[question.code];
            const scaleMax =
              question.type === "scale" ? (question.options?.length ?? 5) : null;
            const scaleValue =
              scaleMax && rawAnswer ? (question.options?.indexOf(rawAnswer) ?? -1) : -1;
            return (
              <div
                key={question.code}
                className="flex items-start justify-between gap-3 py-3.5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-muted-foreground text-xs">{question.text}</p>
                  {scaleMax && scaleValue >= 0 ? (
                    <ScaleStars value={scaleValue + 1} max={scaleMax} />
                  ) : (
                    <p className="text-foreground text-sm font-medium break-words">
                      {rawAnswer || t("review.noAnswer")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => jumpToQuestion(index)}
                  className="text-primary shrink-0 text-xs font-medium hover:underline"
                >
                  {t("review.editLabel")}
                </button>
              </div>
            );
          })}
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
      <Button
        className="mt-6 w-full"
        size="lg"
        disabled={submitting}
        onClick={submitSurvey}
      >
        {submitting ? t("review.submitting") : t("review.submit")}
      </Button>
    </Shell>
  );
}
