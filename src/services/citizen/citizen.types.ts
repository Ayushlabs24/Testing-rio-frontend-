export interface ResolvedSurvey {
  studyId: string;
  title: string;
  version: string;
  studyTitle: string;
  organizationName: string;
  questions: Array<{
    code: string;
    text: string;
    type: "text" | "single_choice" | "multi_choice" | "scale";
    options?: string[];
    required: boolean;
  }>;
  questionCount: number;
  estimatedMinutes: number;
}

export interface CheckDuplicatePayload {
  contact: string;
  mobile: string;
}

export interface CheckDuplicateResult {
  isDuplicate: boolean;
}

export interface RequestOtpPayload {
  contact: string;
  mobile: string;
  /** Abandonment tracking — attributes this step to the sitting the page
   *  opened on load. Optional: tracking is best-effort and never blocks a
   *  submission. */
  sessionId?: string;
}

export interface RequestOtpResult {
  challengeId: string;
  expiresAt: string;
  codeTexted: boolean;
  /** Only present when `codeTexted` is false and SMS isn't configured
   * (dev/test) — the only way the respondent can get the code at all. */
  code?: string;
}

export interface VerifyOtpPayload {
  challengeId: string;
  code: string;
  sessionId?: string;
}

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

/** Matches the Prisma AgeBracket enum's identifiers exactly (see
 * schema.prisma) — never exact age/DOB. "prefer_not_to_say" is the
 * respondent's opt-out; unlike Gender, this field is mandatory. */
export type AgeBracket =
  | "age_15_24"
  | "age_25_34"
  | "age_35_44"
  | "age_45_54"
  | "age_55_64"
  | "age_65_plus"
  | "prefer_not_to_say";

export interface SubmitResponsePayload {
  challengeId: string;
  contactName?: string;
  gender?: Gender;
  ageBracket: AgeBracket;
  answers: Record<string, string>;
  sessionId?: string;
}

export interface SubmitResponseResult {
  id: string;
  submittedAt: string;
}

// ── Abandonment tracking (RPT10 Q-2, client answer 24 Aug) ──
//
// "Partially completed surveys are not saved as data records … the system
// should track abandonment … at the session/event level (that a survey was
// started and not completed), not by retaining the partial answer data
// itself."
//
// Which is why there is no answer field anywhere below: the page reports the
// STEP it reached and HOW MANY questions had a value, never which or what.

export type SurveySessionStep =
  "OPENED" | "DETAILS" | "OTP_REQUESTED" | "OTP_VERIFIED" | "ANSWERING" | "REVIEW";

export interface StartSessionResult {
  sessionId: string;
}

export interface RecordSessionEventPayload {
  step: SurveySessionStep;
  /** Question index reached — a position, not an answer. */
  position?: number;
  /** How many questions currently hold a value. A count only. */
  answeredCount?: number;
}
