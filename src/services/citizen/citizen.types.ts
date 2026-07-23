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
}

export interface CheckDuplicateResult {
  isDuplicate: boolean;
}

export interface RequestOtpPayload {
  contact: string;
}

export interface RequestOtpResult {
  challengeId: string;
  expiresAt: string;
  codeEmailed: boolean;
  /** Only present when `codeEmailed` is false and no mailer is configured
   * (dev/test) — the only way the respondent can get the code at all. */
  code?: string;
}

export interface VerifyOtpPayload {
  challengeId: string;
  code: string;
}

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface SubmitResponsePayload {
  challengeId: string;
  contactName?: string;
  gender?: Gender;
  answers: Record<string, string>;
}

export interface SubmitResponseResult {
  id: string;
  submittedAt: string;
}
