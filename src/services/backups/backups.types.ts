/** RIO-NFR-010 — backup administration. */

export type BackupKind = "database" | "attachments";
export type BackupStatus = "running" | "succeeded" | "failed";
export type BackupTrigger = "schedule" | "manual";

export const BACKUP_KINDS: BackupKind[] = ["database", "attachments"];
export const BACKUP_STATUSES: BackupStatus[] = ["running", "succeeded", "failed"];

export interface BackupRun {
  id: string;
  kind: BackupKind;
  status: BackupStatus;
  trigger: BackupTrigger;
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  fileName: string | null;
  sizeBytes: number | null;
  /** SHA-256 taken when the file was written — what `verify` re-checks. */
  sha256: string | null;
  /** Files captured by an attachment run. Null for a database run. */
  fileCount: number | null;
  retainUntil: string | null;
  prunedAt: string | null;
  error: string | null;
}

export interface BackupRunPage {
  items: BackupRun[];
  total: number;
}

export interface BackupSummary {
  /**
   * When a backup last SUCCEEDED, not when one last ran. A failed run is
   * worse than no run, because it looks like coverage.
   */
  lastSuccessfulDatabase: string | null;
  lastSuccessfulAttachments: string | null;
  failuresLast7Days: number;
  totalSizeBytes: number;
}

export interface BackupVerifyResult {
  ok: boolean;
  /**
   * Why not, when it is not ok: CHECKSUM_MISMATCH, FILE_MISSING, SIZE_CHANGED,
   * FILE_PRUNED, RUN_DID_NOT_SUCCEED, NO_ARTEFACT_RECORDED, RUN_NOT_FOUND.
   */
  reason: string | null;
}
