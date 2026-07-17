export interface SurveyDefinitionQuestion {
  code: string;
  text: string;
  type: "text" | "single_choice" | "multi_choice" | "scale";
  options?: string[];
  required: boolean;
}

/**
 * Survey Builder doesn't exist yet — the backend's Survey Definition
 * Service returns a fixed placeholder question set today. Only this
 * endpoint's internals change once Survey Builder ships; this shape and
 * every caller of it stay the same.
 */
export interface SurveyDefinition {
  studyId: string;
  title: string;
  version: string;
  questions: SurveyDefinitionQuestion[];
}

export interface PublicSurveyLink {
  id: string;
  studyId: string;
  /** User-facing name — the only identifier ever shown for a link; never the token/id. */
  label: string;
  token: string;
  /** Plain public URL — QR is rendered client-side from this, no server-generated image. */
  publicUrl: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  responseCount: number;
}

export interface CreateSurveyLinkPayload {
  label: string;
  expiresInDays?: number;
}
