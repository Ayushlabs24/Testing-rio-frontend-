// RIO-FR-013 archives a study conducted before the platform existed, as a
// reference file plus its metadata. RIO-DATA-002 / FR-17 then turns the
// needs *inside* that file into real Need rows under a real Study, which is
// what puts them in the unified dashboard instead of behind a download link.

export interface HistoricalStudy {
  id: string;
  orgId: string;
  orgName: string;
  title: string;
  region: string[];
  governorateIds: string[];
  governorateNames: string[];
  centerIds: string[];
  centerNames: string[];
  targetSector: string | null;
  studyDate: string;
  author: string;
  methodologyVersionLabel: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
}

export interface CreateHistoricalStudyPayload {
  title: string;
  region: string[];
  governorateIds: string[];
  centerIds: string[];
  targetSector?: string;
  studyDate: string;
  author: string;
  methodologyVersionLabel: string;
  file: File;
}

/** A row the importer could not turn into a Need. */
export interface HistoricalImportRowError {
  row: number;
  message: string;
  /** `duplicate` — matches a need already imported, or an earlier row in
   *  the same file. `validation` — anything else (missing title, an
   *  affected-population cell that is not a number, and so on). */
  type: "duplicate" | "validation";
}

export interface HistoricalStudyImportResult {
  historicalStudyId: string;
  studyId: string;
  studyTitle: string;
  /** Pre-platform studies count backwards from 0, so they sort before
   *  cycle 1 rather than being renumbered into the live cycle sequence. */
  cycleNumber: number;
  totalRows: number;
  imported: number;
  failed: number;
  errors: HistoricalImportRowError[];
}

/** Formats the importer can read. Anything else is archived as a document
 *  only and has to be converted to one need per row first — see
 *  RIO-DATA-002-MIGRATION-REQUIREMENTS.md. */
export const IMPORTABLE_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

export function isImportableFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return IMPORTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
