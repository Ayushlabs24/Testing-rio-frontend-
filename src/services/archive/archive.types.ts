// "historical" — RIO-FR-013 (client Q25) — a study conducted before the
// platform existed, uploaded as a reference file rather than built up
// through Study/Need/Survey.
export type ArchiveEntryKind = "study" | "report" | "historical";

export interface ArchiveEntry {
  id: string;
  kind: ArchiveEntryKind;
  title: string;
  /** For a `historical` entry this is RIO-DATA-002 import state:
   *  `"imported"` once its needs are live in the unified dashboard,
   *  `"completed"` while the file is archived but readable only by
   *  download. Other kinds carry their own lifecycle status. */
  status: string;
  date: string;
  /** For a `historical` entry, the Study its needs were imported into, or
   *  `null` if it has not been imported yet. */
  studyId: string | null;
  organizationId: string;
  organizationName: string;
  region: string[];
  sector: string | null;
  villages: string[];
  // Historical-only detail — undefined for kind "study"/"report". Backs the
  // Archive row-detail popup (client feedback 2026-09-04).
  governorateNames?: string[];
  centerNames?: string[];
  author?: string;
  methodologyVersionLabel?: string;
  uploadedByName?: string | null;
  uploadedAt?: string;
  /** RIO-DATA-002 — the archived file's name, present only on `historical`
   *  entries. The extension decides whether the entry can be imported at
   *  all: only one-need-per-row formats can, so a PDF upload must not be
   *  offered the action. */
  fileName?: string | null;
}

export interface ListArchiveParams {
  kind?: ArchiveEntryKind;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  organizationId?: string;
  region?: string;
  sector?: string;
  village?: string;
}
