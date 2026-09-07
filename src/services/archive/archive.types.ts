// "historical" — RIO-FR-013 (client Q25) — a study conducted before the
// platform existed, uploaded as a reference document.
export type ArchiveEntryKind = "study" | "report" | "historical";

export interface ArchiveEntry {
  id: string;
  kind: ArchiveEntryKind;
  title: string;
  status: string;
  date: string;
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
