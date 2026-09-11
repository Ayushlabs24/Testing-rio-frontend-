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
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { localizedText } from "@/lib/bilingual";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { citizenService } from "@/services/citizen/citizen.service";
import type {
  AgeBracket,
  Gender,
  ResolvedSurvey,
  SurveySessionStep,
} from "@/services/citizen/citizen.types";
import { consentService } from "@/services/consent/consent.service";
import { resolveApiErrorMessage } from "@/lib/api-error-message";
import {
  consentPolicyTextFor,
  type ActiveConsentPolicy,
  type ConsentLocale,
} from "@/services/consent/consent.types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Curated, not exhaustive — Gulf/neighboring countries first (this app is
// KSA-focused, so Saudi Arabia is the default), plus a handful of other
// common codes. A respondent whose country isn't listed can still pick the
// closest match; the actual OTP delivery only cares that the combined
// number is a valid phone shape.
// The consent notice is no longer copy in this bundle. It is a published,
// versioned ConsentPolicy (kind `citizen_consent`) drafted by a System Admin
// and approved by a System Reviewer under Methodology Configuration → Consent
// Policies, fetched below and rendered verbatim. Its version travels with the
// submission so each response records exactly which notice was accepted
// (RIO-NFR-002) — the constant that used to live here could not do that,
// since nothing ever sent it anywhere.

const COUNTRY_DIAL_CODES = [
  { code: "SA", dialCode: "+966", label: "Saudi Arabia (+966)" },
  { code: "AE", dialCode: "+971", label: "UAE (+971)" },
  { code: "BH", dialCode: "+973", label: "Bahrain (+973)" },
  { code: "KW", dialCode: "+965", label: "Kuwait (+965)" },
  { code: "OM", dialCode: "+968", label: "Oman (+968)" },
  { code: "QA", dialCode: "+974", label: "Qatar (+974)" },
  { code: "EG", dialCode: "+20", label: "Egypt (+20)" },
  { code: "JO", dialCode: "+962", label: "Jordan (+962)" },
  { code: "IN", dialCode: "+91", label: "India (+91)" },
  { code: "PK", dialCode: "+92", label: "Pakistan (+92)" },
  { code: "US", dialCode: "+1", label: "United States (+1)" },
  { code: "GB", dialCode: "+44", label: "United Kingdom (+44)" },
] as const;

type LoadState = "loading" | "notFound" | "ready";
// "welcome" carries the study/organisation context that used to live on its
// own post-OTP screen — showing it up front (before asking for any personal
// details) is what the redesign asked for.
type Phase = "welcome" | "details" | "otp" | "questions" | "review";
type TerminalPhase = "submitting" | "submitted";

/** Mobile-first full-page shell — no theme toggle, no logo, no app-shell
 * chrome. Citizens reach this by scanning a QR code on their phone; the
 * only thing on screen should be the survey itself. The one exception is
 * the language switcher: the shared link carries no locale segment, so it
 * always opens in the default locale — without this, a respondent who
 * needs Arabic has no way to get it. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen justify-center">
      <div className="flex w-full max-w-md flex-col px-5 py-8 sm:py-12">
        <div className="mb-2 flex justify-end">
          <LanguageSwitcher />
        </div>
        {children}
      </div>
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
      <ArrowLeft className="size-3.5 rtl:rotate-180" />
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
  const tApiErr = useTranslations("apiErrors");
  // Which language the notice is read in — recorded with the acceptance, for
  // the same reason the version is: together they pin exactly what was
  // agreed to. Narrowed exhaustively, as elsewhere.
  const consentLocale: ConsentLocale = useLocale() === "ar" ? "ar" : "en";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [survey, setSurvey] = useState<ResolvedSurvey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("welcome");
  const [terminal, setTerminal] = useState<TerminalPhase | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [name, setName] = useState("");
  // Both channels are mandatory — a single OTP code is sent to both (see
  // CitizenService.requestOtp on the backend), and the respondent can
  // verify with the code from whichever one they actually checked.
  const [dialCode, setDialCode] = useState<string>(COUNTRY_DIAL_CODES[0].dialCode);
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const contact = email.trim();
  const mobile = `${dialCode}${mobileNumber.replace(/\D/g, "")}`;
  const [gender, setGender] = useState<Gender | "">("");
  const [ageBracket, setAgeBracket] = useState<AgeBracket | "">("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  // Set only when NEITHER channel could be delivered (no mailer/SMS
  // configured — dev/test) and the backend returned the code directly
  // instead, per RequestOtpResult's `code` field — the only way to proceed
  // without a real inbox/phone.
  const [devCode, setDevCode] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Participant consent, collected on the details step before any personal
  // detail leaves the device. Same shape as the NGO Admin's own consent gate
  // (see ConsentGuard): notice, checkbox, explicit must-agree error.
  const [consented, setConsented] = useState(false);
  // RIO-NFR-002 — the published citizen-consent notice. `null` while loading
  // or unavailable; the checkbox stays disabled until it arrives, and the
  // version below is what the submission is recorded against.
  const [consentPolicy, setConsentPolicy] = useState<ActiveConsentPolicy | null>(null);
  const [consentPolicyError, setConsentPolicyError] = useState(false);
  // The wording actually rendered, falling back to English when the notice
  // has no Arabic copy yet — an untranslated policy is a content gap, but a
  // blank consent is a broken survey. The server independently re-derives the
  // same choice when it records the acceptance's locale.
  const consentPolicyText = consentPolicy
    ? consentPolicyTextFor(consentPolicy, consentLocale)
    : "";
  const [submitting, setSubmitting] = useState(false);

  // Abandonment tracking (RPT10 Q-2, client answer 24 Aug). A ref, not state:
  // the id is read inside callbacks and must never trigger a re-render, and a
  // survey the respondent abandons must not have been kept alive by one.
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    citizenService
      .resolveSurvey(token)
      .then((resolved) => {
        setSurvey(resolved);
        setLoadState("ready");
      })
      .catch(() => setLoadState("notFound"));
  }, [token]);

  // RIO-NFR-002 — the notice must be on screen before any personal detail is
  // collected, so it is fetched on mount rather than when the details step is
  // reached. Independent of the survey resolve: a citizen consents to the
  // platform's notice, not to anything about this particular survey.
  useEffect(() => {
    consentService
      .getActiveCitizenPolicy()
      .then((policy) => {
        setConsentPolicy(policy);
        setConsentPolicyError(false);
      })
      .catch(() => {
        // Left null on purpose — the checkbox stays disabled, so a submission
        // can never be made against a notice that failed to load.
        setConsentPolicy(null);
        setConsentPolicyError(true);
      });
  }, []);

  // Opens the session as soon as the survey resolves — the sitting starts when
  // the respondent can see questions, not when they first type. Everything
  // here is best-effort: a failed session write leaves sessionIdRef null and
  // every later track() call becomes a no-op, so tracking can never block a
  // respondent. Nothing about their answers is sent by any of it.
  useEffect(() => {
    if (loadState !== "ready") return;
    let cancelled = false;
    void citizenService.startSession(token).then((result) => {
      // `result?.sessionId` rather than `result` — the backend answers with an
      // empty body when it could not open a session, which the API client
      // surfaces as undefined. Either way tracking stays off and the
      // respondent notices nothing.
      if (!cancelled && result?.sessionId) sessionIdRef.current = result.sessionId;
    });
    return () => {
      cancelled = true;
    };
  }, [loadState, token]);

  // Memoised, not a fresh array each render: the answered-count memo below
  // depends on it, and a new identity every render would recompute (and
  // re-post) on every keystroke.
  const questions = useMemo(() => survey?.questions ?? [], [survey]);

  // Fixed steps (details, otp) + one step per question + review.
  const totalSteps = 2 + questions.length + 1;
  const currentStepNumber = useMemo(() => {
    if (phase === "details") return 1;
    if (phase === "otp") return 2;
    if (phase === "questions") return 2 + questionIndex + 1;
    return totalSteps;
  }, [phase, questionIndex, totalSteps]);

  // How many questions currently hold a value — a COUNT, which is the only
  // thing about the answers that ever leaves the page for tracking purposes.
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.code] ?? "").trim().length > 0).length,
    [questions, answers],
  );

  function track(step: SurveySessionStep, position = 0): void {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    void citizenService.recordSessionEvent(token, sessionId, {
      step,
      position,
      answeredCount,
    });
  }

  // Duplicate submission is checked as soon as the participant provides
  // their contact details — before any OTP challenge (or any other record)
  // is created. Nothing is persisted until the final Submit.
  async function submitDetails() {
    // Every mandatory field here is a named validation failure, not a
    // silently disabled button — mirrors the existing consent gate below,
    // now extended to Name/Mobile/Email/Age Bracket.
    if (!name.trim()) {
      setError(t("details.nameRequired"));
      return;
    }
    if (!mobileNumber.trim()) {
      setError(t("details.mobileRequired"));
      return;
    }
    if (!email.trim()) {
      setError(t("details.emailRequired"));
      return;
    }
    if (!ageBracket) {
      setError(t("details.ageBracketRequired"));
      return;
    }
    if (!consented || !consentPolicy) {
      // Covers both "didn't tick the box" and "the notice never loaded" —
      // there is no version to record consent against in the second case, so
      // proceeding would produce an unconsented response.
      setError(
        t(consentPolicy ? "details.consentRequired" : "details.consentUnavailable"),
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { isDuplicate } = await citizenService.checkDuplicate(token, {
        contact,
        mobile,
      });
      if (isDuplicate) {
        setError(t("details.duplicateError"));
        return;
      }
      // sessionId here is what gives the session a contact channel — the
      // only thing that makes a completion reminder possible at all (see the
      // backend's SurveyReminderService).
      const result = await citizenService.requestOtp(token, {
        contact,
        mobile,
        sessionId: sessionIdRef.current ?? undefined,
      });
      setChallengeId(result.challengeId);
      setDevCode(result.codeTexted ? null : (result.code ?? null));
      setPhase("otp");
    } catch (err) {
      setError(resolveApiErrorMessage(err, tApiErr, t("genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp() {
    if (!challengeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await citizenService.verifyOtp(token, {
        challengeId,
        code,
        sessionId: sessionIdRef.current ?? undefined,
      });
      setQuestionIndex(0);
      // A survey with zero questions has nothing to show on the "questions"
      // phase (which unconditionally renders `questions[questionIndex]`) —
      // go straight to Review instead of crashing. Publishing an empty
      // survey is now blocked server-side, but this protects anyone who
      // already has a link to one published before that guard existed.
      setPhase(questions.length === 0 ? "review" : "questions");
    } catch (err) {
      setError(resolveApiErrorMessage(err, tApiErr, t("genericError")));
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
      // Recorded on each advance, so an abandoned sitting says WHERE it
      // stopped rather than only that it did.
      track("ANSWERING", questionIndex + 1);
    } else {
      setPhase("review");
      track("REVIEW", questions.length);
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
    // ageBracket is mandatory (see the details-phase Submit button's
    // disabled condition) — this guard is just for type-safety here, since
    // SubmitResponsePayload.ageBracket isn't optional.
    if (!challengeId || !ageBracket) return;
    if (!consentPolicy) {
      // Unreachable in practice (the details step already refused to advance
      // without a loaded notice), but the submission is the point of no
      // return: without a version there is nothing to record consent against.
      setError(t("details.consentUnavailable"));
      return;
    }
    setSubmitting(true);
    setTerminal("submitting");
    setError(null);
    try {
      await citizenService.submitResponse(token, {
        challengeId,
        contactName: name || undefined,
        gender: gender || undefined,
        ageBracket,
        answers,
        sessionId: sessionIdRef.current ?? undefined,
        // RIO-NFR-002 — the version and language of the notice this
        // respondent actually read. Only the pointer travels, never the text:
        // the server re-resolves the wording itself and rejects a version
        // that is no longer live (CONSENT_VERSION_STALE).
        consent: { version: consentPolicy.version, locale: consentLocale },
      });
      setTerminal("submitted");
    } catch (err) {
      setError(resolveApiErrorMessage(err, tApiErr, t("genericError")));
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
                  <AutoTranslate text={survey.organizationName} />
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
            <Label htmlFor="citizen-mobile">{t("details.mobileLabel")}</Label>
            <div className="flex gap-2">
              <Select value={dialCode} onValueChange={setDialCode}>
                <SelectTrigger className="w-32 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.dialCode}>
                      {c.dialCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="citizen-mobile"
                type="tel"
                inputMode="tel"
                className="flex-1"
                value={mobileNumber}
                placeholder={t("details.mobilePlaceholder")}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-email">{t("details.emailLabel")}</Label>
            <Input
              id="citizen-email"
              type="email"
              value={email}
              placeholder={t("details.emailPlaceholder")}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-gender">{t("details.genderLabel")}</Label>
            <Select value={gender} onValueChange={(value) => setGender(value as Gender)}>
              <SelectTrigger id="citizen-gender" className="w-full">
                <SelectValue placeholder={t("details.genderPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("details.genderMale")}</SelectItem>
                <SelectItem value="female">{t("details.genderFemale")}</SelectItem>
                <SelectItem value="other">{t("details.genderOther")}</SelectItem>
                <SelectItem value="prefer_not_to_say">
                  {t("details.genderPreferNotToSay")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizen-age-bracket">{t("details.ageBracketLabel")}</Label>
            <Select
              value={ageBracket}
              onValueChange={(value) => setAgeBracket(value as AgeBracket)}
            >
              <SelectTrigger id="citizen-age-bracket" className="w-full">
                <SelectValue placeholder={t("details.ageBracketPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="age_15_24">{t("details.ageBracket15to24")}</SelectItem>
                <SelectItem value="age_25_34">{t("details.ageBracket25to34")}</SelectItem>
                <SelectItem value="age_35_44">{t("details.ageBracket35to44")}</SelectItem>
                <SelectItem value="age_45_54">{t("details.ageBracket45to54")}</SelectItem>
                <SelectItem value="age_55_64">{t("details.ageBracket55to64")}</SelectItem>
                <SelectItem value="age_65_plus">
                  {t("details.ageBracket65plus")}
                </SelectItem>
                <SelectItem value="prefer_not_to_say">
                  {t("details.ageBracketPreferNotToSay")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-border space-y-3 border-t pt-5">
            <div className="space-y-1.5">
              <h2 className="text-foreground text-sm font-semibold">
                {t("details.consentTitle")}
              </h2>
              {consentPolicy ? (
                <p className="text-muted-foreground text-[11px]">
                  {t("details.consentVersionLine", { version: consentPolicy.version })}
                </p>
              ) : null}
            </div>
            {consentPolicy ? (
              // `whitespace-pre-line` because the policy body is plain text
              // authored in a textarea — its paragraph breaks are newlines,
              // and rendering it as HTML would let policy content inject
              // markup into this page.
              //
              // Deliberately NOT height-capped, unlike the admin editor: the
              // respondent scrolls the page itself and reaches the agree
              // checkbox at the end of the notice. A scrollbox here would let
              // someone tick the box with most of the notice never scrolled
              // into view, which is the opposite of what a consent screen is
              // for.
              <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-line">
                {consentPolicyText}
              </p>
            ) : consentPolicyError ? (
              <p className="text-destructive text-xs">
                {t("details.consentUnavailable")}
              </p>
            ) : (
              <div className="bg-muted h-24 animate-pulse rounded-md" />
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="citizen-consent"
                checked={consented}
                // Un-checkable until the notice is actually on screen: a
                // respondent must not be able to agree to something that
                // failed to load.
                disabled={!consentPolicy}
                aria-invalid={Boolean(error) && !consented}
                onCheckedChange={(checked) => {
                  setConsented(checked === true);
                  if (checked === true) setError(null);
                }}
                className="mt-0.5"
              />
              <Label
                htmlFor="citizen-consent"
                className="text-muted-foreground text-xs leading-relaxed font-normal"
              >
                {t("details.consentAgreeLabel")}
              </Label>
            </div>
          </div>

          {/* RIO-NFR-002: a privacy notice before any personal contact
           * detail is collected — this data is used analytically (aggregate
           * needs assessment), never to open an individual case/ticket. */}
          {/* <div className="border-border bg-muted/40 flex items-start gap-2.5 rounded-lg border p-3.5">
            <ShieldCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("details.privacyNotice")}
            </p>
          </div> */}
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={submitting}
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
              {t("otp.description", { mobile })}
            </p>
          </div>
          {devCode ? (
            <div className="border-warning/40 bg-warning/10 space-y-1 rounded-md border p-3">
              <p className="text-foreground text-sm">{t("otp.codeNotEmailed")}</p>
              <p className="border-border bg-background rounded-md border px-3 py-2 font-mono text-sm">
                {devCode}
              </p>
            </div>
          ) : null}
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

  if (phase === "questions" && questions[questionIndex]) {
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
            <Label
              dir="auto"
              className="text-foreground text-lg leading-snug font-semibold"
            >
              {/* `question.textAr` is the client-supplied Question Bank
                  translation when one exists (localizedText resolves it for
                  the current locale, same as every other master-data field
                  in the app); AutoTranslate is the fallback for a custom
                  question with no such column — see citizen.types.ts. When
                  textAr already matches the locale, AutoTranslate is a
                  same-script no-op, so wrapping unconditionally is safe. */}
              <AutoTranslate
                text={localizedText(question.text, question.textAr, consentLocale)}
              />
              {question.required ? (
                <span className="text-destructive ms-1">{t("form.requiredMark")}</span>
              ) : null}
            </Label>
            {question.type === "scale" || question.type === "single_choice" ? (
              <div className="flex flex-wrap gap-2">
                {question.options?.map((option, i) => (
                  <Button
                    key={option}
                    type="button"
                    size="default"
                    variant={answers[question.code] === option ? "default" : "outline"}
                    onClick={() => setAnswers({ ...answers, [question.code]: option })}
                  >
                    {/* The submitted/compared value is always the canonical
                        English `option` above — only this label follows the
                        locale (see optionsAr's own comment in citizen.types.ts). */}
                    <AutoTranslate
                      text={localizedText(option, question.optionsAr?.[i], consentLocale)}
                    />
                  </Button>
                ))}
              </div>
            ) : question.type === "multi_choice" ? (
              <div className="flex flex-wrap gap-2">
                {question.options?.map((option, i) => {
                  const selected = (answers[question.code] ?? "")
                    .split(", ")
                    .filter(Boolean);
                  const isSelected = selected.includes(option);
                  return (
                    <Button
                      key={option}
                      type="button"
                      size="default"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        const next = isSelected
                          ? selected.filter((o) => o !== option)
                          : [...selected, option];
                        setAnswers({ ...answers, [question.code]: next.join(", ") });
                      }}
                    >
                      <AutoTranslate
                        text={localizedText(
                          option,
                          question.optionsAr?.[i],
                          consentLocale,
                        )}
                      />
                    </Button>
                  );
                })}
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
          if (questions.length === 0) {
            setPhase("otp");
            return;
          }
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
                  {/* Same locale resolution as the question screen above —
                      client-supplied `textAr` first, AutoTranslate fallback
                      for a custom question with no such column. */}
                  <p dir="auto" className="text-muted-foreground text-xs">
                    <AutoTranslate
                      text={localizedText(question.text, question.textAr, consentLocale)}
                    />
                  </p>
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
