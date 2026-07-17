import type { StudyStatus } from "@/services/studies/studies.types";

/**
 * A Need's editability tracks its parent Study.status — there is deliberately
 * no Need-level status or version column (Need.studyId is unique, so a Need's
 * lifecycle *is* its Study's; a second source of truth could only drift).
 *
 * Editable while the study is still being put together; reviewer-only once
 * evidence/AI work depends on the need; frozen once a human has reviewed it.
 */
export const NEED_EDITABLE_STATUSES: readonly StudyStatus[] = ["draft", "need_captured"];
export const NEED_REVIEWER_ONLY_STATUSES: readonly StudyStatus[] = [
  "evidence_submitted",
  "ai_classified",
];

/**
 * - `editable`     — this user can edit it now.
 * - `reviewer_only`— this user can't, but a human_reviewer could (backend: 403).
 * - `locked`       — nobody can, reviewers included (backend: 409).
 *
 * The reviewer_only/locked split is not cosmetic: it's the difference between
 * "ask a reviewer" and "this is final", so don't collapse them into one flag.
 */
export type NeedLockState = "editable" | "reviewer_only" | "locked";

export function needLockState(
  status: StudyStatus,
  roleKey: string | undefined,
): NeedLockState {
  if (NEED_EDITABLE_STATUSES.includes(status)) return "editable";
  if (NEED_REVIEWER_ONLY_STATUSES.includes(status)) {
    return roleKey === "human_reviewer" ? "editable" : "reviewer_only";
  }
  return "locked";
}

export interface Need {
  id: string;
  studyId: string;
  title: string;
  statement: string;
  village: string[];
  /** System-set by the backend ("manual_entry" for needs captured here).
   * Read-only — it isn't in Create/UpdateNeedPayload, and sending it is a 400. */
  source: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNeedPayload {
  title: string;
  statement: string;
  village: string[];
}

export interface UpdateNeedPayload {
  title?: string;
  statement?: string;
  village?: string[];
}
