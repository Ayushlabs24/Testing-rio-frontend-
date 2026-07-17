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
}

export interface VerifyOtpPayload {
  challengeId: string;
  code: string;
}

export interface SubmitResponsePayload {
  challengeId: string;
  contactName?: string;
  answers: Record<string, string>;
}

export interface SubmitResponseResult {
  id: string;
  submittedAt: string;
}
