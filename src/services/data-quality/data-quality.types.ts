// RIO-FR-002 — the Data Quality reviewer queue.

export type CleaningSource = "manual_entry" | "survey_response" | "file_upload";
export type CleaningSeverity = "missing" | "non_standard" | "out_of_vocabulary";
export type FlagStatus = "pending" | "accepted" | "rejected" | "superseded";

/** One candidate place a village name might resolve to. */
export interface PlaceCandidate {
  code: string;
  name: string;
  governorate: string | null;
  score: number;
}

export interface FlagDetail {
  field?: string;
  reason?: string;
  candidates?: PlaceCandidate[];
  matchedName?: string;
  governorate?: string | null;
  /** A survey-response flag on a PII field carries no value, only a shape. */
  redacted?: boolean;
  proposedShape?: string;
  dayFirst?: string;
  monthFirst?: string;
  writtenUnit?: string;
  expectedUnit?: string;
  filedUnder?: string;
  belongsTo?: string;
  message?: string;
  [key: string]: unknown;
}

export interface CleaningFlag {
  id: string;
  source: CleaningSource;
  entityType: "need" | "survey_response" | "response_answer" | "import_row";
  entityId: string | null;
  /** "NEED-000042 · Clinic access", or "Row 7" for an import row. */
  entityLabel: string | null;
  rowNumber: number | null;
  field: string;
  ruleCode: string;
  severity: CleaningSeverity;
  originalValue: string | null;
  proposedValue: string | null;
  /** 0..1 when the proposal involved a judgement; null when deterministic. */
  confidence: number | null;
  detail: FlagDetail | null;
  status: FlagStatus;
  note: string | null;
  reviewedAt: string | null;
  createdAt: string;
  /** False when there is nothing to apply — the fix is on the record itself. */
  acceptable: boolean;
}

export interface FlagPage {
  items: CleaningFlag[];
  total: number;
}

/** Q14's per-source report. */
export interface DataQualitySummary {
  bySource: { source: CleaningSource; status: FlagStatus; count: number }[];
  byRule: {
    ruleCode: string;
    severity: CleaningSeverity;
    source: CleaningSource;
    count: number;
  }[];
  lastRunAt: string | null;
}

export interface ListFlagsParams {
  source?: CleaningSource;
  status?: FlagStatus;
  severity?: CleaningSeverity;
  ruleCode?: string;
  page?: number;
  pageSize?: number;
}

// ─── Q40's shared duplicate queue ──────────────────────────────────────────

export type DuplicateMethod = "literal" | "semantic";
export type DuplicateScope = "within_study" | "within_org" | "cross_org";
export type DuplicateStatus =
  "pending" | "confirmed_duplicate" | "not_duplicate" | "merged" | "dismissed";

export interface DuplicateNeedSummary {
  id: string;
  /** "NEED-000042" */
  reference: string;
  title: string;
  statement: string;
  village: string[];
  domain: string | null;
  subDomain: string | null;
  referenceId: string | null;
  studyTitle: string | null;
  createdAt: string;
}

export interface DuplicateCandidate {
  id: string;
  scope: DuplicateScope;
  /** Which pass proposed the pair — the two warrant different scrutiny. */
  method: DuplicateMethod;
  score: number;
  threshold: number;
  status: DuplicateStatus;
  note: string | null;
  reviewedAt: string | null;
  detectedAt: string;
  /** The model's stated reason, for a semantic pair. Null for a literal one. */
  aiReason: string | null;
  needA: DuplicateNeedSummary | null;
  needB: DuplicateNeedSummary | null;
}

export interface DuplicatePage {
  items: DuplicateCandidate[];
  total: number;
}

export interface ListDuplicatesParams {
  status?: DuplicateStatus;
  method?: DuplicateMethod;
  page?: number;
  pageSize?: number;
}

// ─── RIO-AI-004: merge ─────────────────────────────────────────────────────

/** What a merge would do — the reviewer confirms THIS, not a guess. */
export interface MergePreview {
  survivor: { id: string; reference: string; title: string; referenceId: string | null };
  retired: { id: string; reference: string; title: string; referenceId: string | null };
  /** What moves, by model, with counts. */
  transfers: { entityType: string; count: number }[];
  totalTransfers: number;
  /** The retired number, which keeps resolving to the survivor afterwards. */
  aliasedReference: string;
  externalReferences: string[];
  /** Published reports that stay frozen as historical record (Q24). */
  frozenReportCount: number;
  scoresToRecalculate: number;
  warnings: string[];
}

export interface MergeResult {
  mergeId: string;
  transferred: number;
}

export interface MergeHistoryItem {
  id: string;
  survivor: { id: string; reference: string; title: string } | null;
  retired: { id: string; reference: string; title: string } | null;
  transferredCount: number;
  note: string | null;
  decidedAt: string;
  decidedByName: string | null;
  undoneAt: string | null;
  undoneByName: string | null;
  undoNote: string | null;
  /** False once undone — a merge is reversed once, not repeatedly. */
  canUndo: boolean;
}

export interface MergeHistoryPage {
  items: MergeHistoryItem[];
  total: number;
}
