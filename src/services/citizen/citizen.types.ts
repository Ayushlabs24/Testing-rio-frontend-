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
}

export interface SubmitResponseResult {
  id: string;
  submittedAt: string;
}
