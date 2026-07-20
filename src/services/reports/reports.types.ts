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
] as const;
export type ReportTypeCode = (typeof REPORT_TYPES)[number];

export type ReportStatus = "draft" | "approved" | "rejected";
export type ExportFormat = "pdf" | "excel";

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
    requiresStudyId: false,
  },
  RPT05: {
    name: "Governorate-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
  },
  RPT06: {
    name: "Region/Governorate Filtering",
    exportFormats: [],
    requiresStudyId: false,
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
  RPT12: { name: "Report Sharing Status", exportFormats: [], requiresStudyId: false },
  RPT13: { name: "Executive Summary", exportFormats: ["pdf"], requiresStudyId: true },
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
  reviewedBy: string | null;
  reviewedAt: string | null;
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
