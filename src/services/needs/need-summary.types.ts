/** Mirrors the backend's NeedSummaryTriggerSource — which entry point produced
 *  the Need this summary belongs to. */
export type NeedSummaryTriggerSource =
  "manual_entry" | "bulk_import" | "pdf_import" | "citizen_input" | "manual_regenerate";

/** DRAFT awaits review · CONFIRMED is live and is what reports print ·
 *  SUPERSEDED was replaced by a newer summary · STALE means the underlying
 *  statement changed after the summary was decided. */
export type NeedSummaryStatus = "DRAFT" | "CONFIRMED" | "SUPERSEDED" | "STALE";

/** RIO-AI-003 AC 5's mechanical checks. The backend runs these at generation
 *  and stores the result; the reviewer UI shows them so a suspect summary gets
 *  read against its source before it is confirmed. */
export type SummaryWarningCode =
  "FACT_NOT_IN_SOURCE" | "FACT_DROPPED" | "NUMBER_INVENTED";

export interface SummaryWarning {
  code: SummaryWarningCode;
  detail: string;
}

export interface NeedSummary {
  id: string;
  needId: string;
  studyId: string;
  /** Only populated by the reviewer-queue read. */
  needTitle: string | null;
  status: NeedSummaryStatus;
  promptVersion: string;
  modelName: string;
  /** AC 4 — the original description, returned alongside the summary on every
   *  read so the UI never has to fetch it separately to show both. */
  sourceStatement: string;
  sourceLength: number;
  /** The model's own text. The backend never overwrites this on an edit. */
  aiSummaryText: string;
  reviewerEditedText: string | null;
  /** What to display. The backend resolves the AI-vs-edited precedence so every
   *  caller renders the same text. */
  effectiveText: string;
  wasEdited: boolean;
  triggerSource: NeedSummaryTriggerSource;
  verificationWarnings: SummaryWarning[];
  generatedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface PendingNeedSummaries {
  items: NeedSummary[];
  total: number;
}

export interface ConfirmBatchResult {
  confirmed: string[];
  /** Ids that did not take — already confirmed, or superseded by a newer
   *  summary while the reviewer had the queue open. */
  skipped: string[];
}
