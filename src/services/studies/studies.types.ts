/** Mirrors the backend's `StudyStatus` enum exactly (see the backend's studies.types.ts). */
export const STUDY_STATUSES = [
  "draft",
  "need_captured",
  "evidence_submitted",
  "ai_classified",
  "human_reviewed",
] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];

/**
 * Status is workflow-driven (capturing a Need, uploading Evidence, running
 * AI Classification, human review all advance it server-side) — a user can
 * only ever rename the title directly; everything else about the lifecycle
 * moves forward through those other screens, never a free-form edit.
 *
 * `villages` is the set the study concerns, chosen at create. A Need carries
 * its own `village` list (see `needs.types.ts`) which starts from the Study's
 * but can then diverge — the Study's is the wider scope, the Need's is what
 * that specific need is actually about.
 */
export interface Study {
  id: string;
  title: string;
  villages: string[];
  status: StudyStatus;
  /** Null = no reviewer assigned yet (pre-existing Study, or org had no NGO Research Officer at creation). */
  assignedReviewerId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /studies/{id}` only — the list endpoint doesn't compute this per row. */
export interface StudyDetail extends Study {
  evidenceCount: number;
}

/**
 * There is no cross-entity studies listing on the backend (unlike
 * Organizations/Users) — `GET /studies` always scopes to the caller's own
 * org via ambient org context, even for a cross-entity role. So list rows
 * are just `Study`, no `organizationName` column to show.
 */
export type StudySummary = Study;

export interface CreateStudyPayload {
  title: string;
  villages?: string[];
}

export interface UpdateStudyPayload {
  title?: string;
  villages?: string[];
}

/** Study-create's reviewer picker — just enough to render "Full Name / Email". */
export interface AssignableReviewer {
  id: string;
  name: string;
  email: string;
}

export interface ListStudiesParams {
  limit?: number;
  offset?: number;
  status?: StudyStatus;
  search?: string;
}

/**
 * Business rule (per Ganesh): a study can be deleted up through
 * evidence_submitted — once AI Classification or Human Review has acted on
 * it, other people rely on it and it can no longer be deleted (the backend
 * enforces this with a 409 STUDY_NOT_DELETABLE; this list is only used to
 * decide whether to show the delete action at all).
 */
export const DELETABLE_STUDY_STATUSES: readonly StudyStatus[] = [
  "draft",
  "need_captured",
  "evidence_submitted",
];

/** Dashboard counters. Still mock-backed — no stats endpoint exists yet. */
export interface PlatformStudyStats {
  activeStudies: number;
  pendingReviews: number;
  reportsGenerated: number;
}
