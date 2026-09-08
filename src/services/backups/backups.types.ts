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

/**
 * RIO-NFR-010 AC 1 — "can this be restored", which `verify` does not answer.
 *
 * A checksum proves the bytes did not change. It cannot prove they were ever
 * restorable: a dump carrying schema and no data, or an archive missing half
 * its evidence, both checksum perfectly. This is the result of opening the
 * artefact and reading its structure.
 */
export interface BackupRecoverability {
  ok: boolean;
  /** The cheap half — so the UI can say WHICH check failed. */
  checksumOk: boolean;
  /** NO_TABLE_DATA, MANIFEST_MISMATCH, ARCHIVE_UNREADABLE, ... */
  reason: string | null;
  checkedAt: string;
  durationMs: number;
  detail: {
    tocEntries?: number;
    tableDataEntries?: number;
    filesVerified?: number;
    filesExpected?: number;
  };
}
