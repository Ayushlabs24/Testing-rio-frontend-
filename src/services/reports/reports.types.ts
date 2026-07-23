export const REPORT_TYPES = [
  "RPT01",
  "RPT02",
  "RPT03",
  "RPT04",
  "RPT05",
  "RPT06",
  "RPT07",
  "RPT08",
  "RPT09",
  "RPT10",
  "RPT11",
  "RPT12",
  "RPT13",
  "RPT14",
] as const;
export type ReportTypeCode = (typeof REPORT_TYPES)[number];

// Report types offered in the "Generate Report" dialog — the ones this feature
// builds real reports for (the client's expected set). Placeholder/unrequested
// types (RPT01/03/05/07–11) are intentionally hidden from generation, ordered
// to match the requirements: Village, Sector, Region, Executive, Collective,
// Report Sharing.
export const GENERATABLE_REPORT_TYPES: ReportTypeCode[] = [
  "RPT14", // Village Report
  "RPT04", // Sector (Domain-wise Needs)
  "RPT06", // Region / Governorate
  "RPT13", // Executive Summary
  "RPT02", // Collective Report / Dashboard
  "RPT12", // Report Sharing Status
];

export type ReportStatus = "draft" | "rejected" | "released" | "archived";
export type ExportFormat = "pdf" | "excel";

// Statuses from which a report may be exported/shared (mirrors the backend's
// EXPORTABLE_STATUSES) — reviewer approval (release) is required first.
export const EXPORTABLE_STATUSES: ReportStatus[] = ["released", "archived"];

/** Mirrors the backend's REPORT_TYPE_META exactly (new scope.md §9). */
export const REPORT_TYPE_META: Record<
  ReportTypeCode,
  { name: string; exportFormats: ExportFormat[]; requiresStudyId: boolean }
> = {
  RPT01: {
    name: "Individual Study Report",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
  },
  RPT02: {
    name: "Collective Report / Dashboard",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT03: {
    name: "Top Needs View",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT04: {
    name: "Domain-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
  },
  RPT05: {
    name: "Governorate-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT06: {
    name: "Region/Governorate Filtering",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
  },
  RPT07: {
    name: "Gender-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT08: { name: "KPI Results", exportFormats: ["excel"], requiresStudyId: false },
  RPT09: {
    name: "Priority Ranking",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT10: {
    name: "Data Quality Indicators",
    exportFormats: ["excel"],
    requiresStudyId: false,
  },
  RPT11: { name: "Previous Studies View", exportFormats: [], requiresStudyId: false },
  RPT12: {
    name: "Report Sharing Status",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT13: {
    name: "Executive Summary",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
  },
  RPT14: {
    name: "Village Report",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
  },
};

export interface Report {
  id: string;
  reportType: ReportTypeCode;
  status: ReportStatus;
  title: string;
  studyId: string | null;
  filters: Record<string, unknown>;
  content: Record<string, unknown>;
  generatedBy: string;
  generatedAt: string;
  officerConfirmedBy: string | null;
  officerConfirmedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  archivedAt: string | null;
  exportFormats: ExportFormat[];
}

export interface CreateReportPayload {
  reportType: ReportTypeCode;
  studyId?: string;
  filters?: Record<string, unknown>;
}

export interface ListReportsParams {
  reportType?: ReportTypeCode;
  status?: ReportStatus;
  studyId?: string;
}
