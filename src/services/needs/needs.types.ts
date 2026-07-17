export type NeedStatus =
  | "draft"
  | "evidence_submitted"
  | "ai_classified"
  | "reviewer_approved"
  | "survey_created"
  | "survey_published";

/**
 * A Need runs its own independent workflow now (a Study can hold many
 * Needs) — it's editable only in `draft`. Every later stage has produced
 * downstream artifacts (evidence, an AI classification, a survey...) that an
 * in-place edit would silently invalidate. `survey_published` is terminal:
 * the Need is done.
 */
export const NEED_EDITABLE_STATUSES: readonly NeedStatus[] = ["draft"];

export type NeedLockState = "editable" | "locked";

export function needLockState(status: NeedStatus): NeedLockState {
  return NEED_EDITABLE_STATUSES.includes(status) ? "editable" : "locked";
}

export interface Need {
  id: string;
  studyId: string;
  title: string;
  statement: string;
  village: string[];
  /** Where this Need came from — user-entered on manual creation (e.g.
   * "Field Survey"), or "Bulk Import" plus the file's own Source column
   * for an imported row. */
  source: string;
  /** The submitter's own external tracking id (a field form number, a
   * partner org's case id, etc.) — free text, optional. */
  referenceId: string | null;
  status: NeedStatus;
  /** Set once a human approves an AI Classification decision on this Need
   * (see AiDecisionsService.review) — never directly editable. */
  domain: string | null;
  subDomain: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNeedPayload {
  title: string;
  statement: string;
  village: string[];
  source?: string;
  referenceId?: string;
}

export interface UpdateNeedPayload {
  title?: string;
  statement?: string;
  village?: string[];
  source?: string;
  referenceId?: string | null;
}

export interface ImportNeedRowError {
  row: number;
  message: string;
}

export interface ImportNeedsResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: ImportNeedRowError[];
}
