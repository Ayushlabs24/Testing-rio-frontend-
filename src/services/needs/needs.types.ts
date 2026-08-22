export type NeedStatus =
  | "draft"
  | "pending_ai_classification"
  | "evidence_submitted"
  | "ai_classified"
  | "ai_classification_failed"
  | "reviewer_approved"
  | "survey_created"
  | "survey_published";

/**
 * AI Classification now runs automatically right after a Need is saved — a
 * Need stays editable through `pending_ai_classification`/
 * `ai_classification_failed`, but NOT once `ai_classified`: editing the
 * Statement/Governorates/Centers after that would leave the classification
 * stale against changed input. To edit an `ai_classified` (or later) Need,
 * an Approver must Reject it on the AI Review screen first, which resets it
 * to `pending_ai_classification`.
 */
export const NEED_EDITABLE_STATUSES: readonly NeedStatus[] = [
  "draft",
  "pending_ai_classification",
  "ai_classification_failed",
];

/**
 * Evidence gets a slightly wider window than the Need's own Statement/
 * Governorates/Centers — through `ai_classified`, not just up to it.
 * Classification never reads evidence content (the Statement is always the
 * sole input), so a file attached after classification completes doesn't
 * invalidate anything, unlike editing the Need itself. This also matters in
 * practice: classification is triggered automatically the instant a Need is
 * created, so a fast classification can land before a just-created Need's
 * staged evidence finishes uploading — gating evidence on the narrower
 * NEED_EDITABLE_STATUSES would make that upload silently fail.
 */
export const EVIDENCE_EDITABLE_STATUSES: readonly NeedStatus[] = [
  ...NEED_EDITABLE_STATUSES,
  "ai_classified",
];

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
  // Optional link into the KSA Geographic Reference master data — additive
  // alongside `village`, not a replacement. Multi-select Governorates and
  // Centers — a single Need can span multiple geographic areas. No Region
  // field — derived live from the owning Organization's own single region.
  governorateIds: string[];
  centerIds: string[];
  source: NeedSource;
  /** The submitter's own external tracking id (a field form number, a
   * partner org's case id, etc.) — free text, optional. */
  referenceId: string | null;
  /** System-generated internal reference, e.g. "NEED-000123" — assigned to
   * every Need on creation regardless of entry method, never editable.
   * Distinct from `referenceId` above (the submitter's own external id). */
  internalReferenceId: string;
  status: NeedStatus;
  /** The Approver's final ("Approved") Domain/Sub-Domain — written only by
   * AiDecisionsService.review when a classification is approved/overridden.
   * Distinct from aiSuggestedDomain below, which never changes once set. */
  domain: string | null;
  subDomain: string | null;
  /** True when AI couldn't confidently classify this Need at all — every
   * active Domain/Sub-domain is implicitly in scope rather than one
   * specific pair, until a human narrows it down via Override. */
  allDomainsSelected: boolean;
  /** The real, multi-valued source of truth for this Need's classification
   * — domain/subDomain above always mirror needDomains[0]. Empty while
   * allDomainsSelected is true, or before any Approver review has happened
   * yet. */
  needDomains: { domain: string; subDomain: string }[];
  /** AI Classification's own original prediction — written once when
   * classification completes and never overwritten again, including on
   * Approver override, so it always reflects what the AI actually
   * predicted (an audit trail of predicted vs. decided). */
  aiSuggestedDomain: string | null;
  aiSuggestedSubDomain: string | null;
  /** When the most recent classification attempt completed (success or
   * failure) — cleared and re-set on every retry. */
  classifiedAt: string | null;
  /** Populated only while status = ai_classification_failed. */
  classificationError: string | null;
  /** A staged (not-yet-decided) Override — set by whoever last clicked
   * "Preview Override" (any session, any device), cleared once approved or
   * rejected. Deliberately separate from domain/subDomain/needDomains above
   * (the authoritative, final classification) — nothing else reads this,
   * it exists purely so a staged proposal is visible to whoever reviews
   * next, not just the browser tab that staged it. */
  proposedDomains: { domain: string; subDomain: string }[] | null;
  proposedReason: string | null;
  /** RIO-FR-005 (Q12) — one of GAP_TYPES (see priority.types.ts), or null.
   * Analyst-entered, never auto-calculated. */
  gapType: string | null;
  createdBy: string;
  /** Resolved display name for Entered By — null if the creating user has
   * since been removed. */
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNeedPayload {
  // Optional — the backend derives a fallback title from the statement
  // when omitted, so a Need never ends up with no display title.
  title?: string;
  statement: string;
  village?: string[];
  governorateIds?: string[];
  centerIds?: string[];
  referenceId?: string;
}

export interface UpdateNeedPayload {
  title?: string;
  statement?: string;
  village?: string[];
  governorateIds?: string[];
  centerIds?: string[];
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

export interface ParsedPdfNeedItem {
  id: string;
  title: string;
  statement: string;
  village?: string;
  referenceId?: string;
}

export interface PdfPreviewResult {
  totalExtracted: number;
  needs: ParsedPdfNeedItem[];
}

export interface BulkImportNeedItem {
  title: string;
  statement: string;
  village?: string;
  referenceId?: string;
}
