export interface PublicSurveyLink {
  id: string;
  needId: string;
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
