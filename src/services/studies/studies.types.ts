/** Mirrors the backend `StudyStatus` enum. */
export const STUDY_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];

/** Mirrors the backend `StudyReviewStatus` enum (the FR-8 review gate). */
export const STUDY_REVIEW_STATUSES = ["none", "pending", "approved", "rejected"] as const;
export type StudyReviewStatus = (typeof STUDY_REVIEW_STATUSES)[number];

/**
 * Statuses a user may set. `archived` is reached by deleting, never chosen, so
 * the UI never offers it — matching the backend's UpdateStudyBody.
 */
export const SELECTABLE_STUDY_STATUSES = ["draft", "active", "completed"] as const;
export type SelectableStudyStatus = (typeof SELECTABLE_STUDY_STATUSES)[number];

/**
 * The AI's suggestion alongside the human's decision on it. Both are always
 * stored (FR-3) — the UI must be able to show that the AI said one thing and a
 * person decided another. Null throughout until the classification story lands.
 */
export interface StudyClassification {
  ai: { domain: string | null; subDomain: string | null; confidence: number | null };
  human: { domain: string | null; subDomain: string | null };
  overrideReason: string | null;
  classifiedAt: string | null;
}

export interface Study {
  id: string;
  title: string;
  description: string | null;
  needStatement: string | null;
  villages: string[];
  status: StudyStatus;
  reviewStatus: StudyReviewStatus;
  methodologyVersion: string;
  cycleNumber: number;
  classification: StudyClassification;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** List rows carry the owning org so a supervisor's cross-org list is readable. */
export interface StudySummary extends Study {
  organizationId: string;
  organizationName?: string;
}

export interface CreateStudyPayload {
  title: string;
  description?: string | null;
  needStatement?: string | null;
  villages?: string[];
}

export interface UpdateStudyPayload {
  title?: string;
  description?: string | null;
  needStatement?: string | null;
  villages?: string[];
  status?: SelectableStudyStatus;
}

export interface ListStudiesParams {
  limit?: number;
  offset?: number;
  status?: StudyStatus;
  village?: string;
  q?: string;
}

/** Dashboard counters. Still mock-backed — no stats endpoint exists yet. */
export interface PlatformStudyStats {
  activeStudies: number;
  pendingReviews: number;
  reportsGenerated: number;
}
