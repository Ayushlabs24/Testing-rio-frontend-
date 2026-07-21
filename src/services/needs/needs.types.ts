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

/** Where a Need came from — system-assigned only (RIO-FR-001), never
 * user-editable. `citizen_input`/`field_survey` are valid values with no
 * producing flow yet in this app. */
export type NeedSource =
  "manual_entry" | "file_upload" | "citizen_input" | "field_survey";

export interface Need {
  id: string;
  studyId: string;
  title: string;
  statement: string;
  village: string[];
  source: NeedSource;
  /** The submitter's own external tracking id (a field form number, a
   * partner org's case id, etc.) — free text, optional. */
  referenceId: string | null;
  status: NeedStatus;
  /** Manual, authoritative Domain Category — selected by the Researcher at
   * creation (mandatory), editable while still `draft`. This is what
   * reporting/scoring/downstream processing reads. */
  domain: string | null;
  subDomain: string | null;
  /** AI Classification's own suggestion — stored for transparency/future
   * reference only once a human reviews it (see AiDecisionsService.review).
   * Never the authoritative value, never used downstream. */
  aiSuggestedDomain: string | null;
  aiSuggestedSubDomain: string | null;
  createdBy: string;
  /** Resolved display name for Entered By — null if the creating user has
   * since been removed. */
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNeedPayload {
  title: string;
  statement: string;
  village: string[];
  domain: string;
  subDomain: string;
  referenceId?: string;
}

export interface UpdateNeedPayload {
  title?: string;
  statement?: string;
  village?: string[];
  domain?: string;
  subDomain?: string;
  referenceId?: string | null;
}

export interface ImportNeedRowError {
  row: number;
  message: string;
  type: "duplicate" | "validation";
}

export interface ImportNeedsResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: ImportNeedRowError[];
}
