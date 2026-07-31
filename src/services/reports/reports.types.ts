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
  "RPT15",
] as const;
export type ReportTypeCode = (typeof REPORT_TYPES)[number];

// Report types offered in the "Generate Report" dialog — the ones this feature
// builds real reports for (the client's expected set). Placeholder/unrequested
// types (RPT03/05/07–12) stay hidden from generation. Ordered survey-scoped
// first (the two that ask "which survey?"), then the study-scoped aggregates.
export const GENERATABLE_REPORT_TYPES: ReportTypeCode[] = [
  "RPT01", // Individual Survey Report (single survey)
  "RPT15", // Survey & Dashboard Report
  "RPT14", // Village Report
  "RPT04", // Sector (Domain-wise Needs)
  "RPT06", // Region / Governorate
  "RPT13", // Executive Summary
];

export type ReportStatus = "draft" | "rejected" | "released" | "archived";
export type ExportFormat = "pdf" | "excel";

// Statuses from which a report may be exported/shared (mirrors the backend's
// EXPORTABLE_STATUSES) — reviewer approval (release) is required first.
export const EXPORTABLE_STATUSES: ReportStatus[] = ["released", "archived"];

/** Mirrors the backend's REPORT_TYPE_META exactly (new scope.md §9). */
export const REPORT_TYPE_META: Record<
  ReportTypeCode,
  {
    name: string;
    exportFormats: ExportFormat[];
    requiresStudyId: boolean;
    // Survey-scoped types (RPT01/RPT15) — the Generate dialog shows a survey
    // picker for these, and the backend 400s with SURVEY_ID_REQUIRED without it.
    requiresSurveyId: boolean;
  }
> = {
  RPT01: {
    name: "Individual Survey Report",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
    requiresSurveyId: true,
  },
  RPT02: {
    name: "Collective Report / Dashboard",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT03: {
    name: "Top Needs View",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT04: {
    name: "Domain-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
    requiresSurveyId: false,
  },
  RPT05: {
    name: "Governorate-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT06: {
    name: "Region/Governorate Filtering",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
    requiresSurveyId: false,
  },
  RPT07: {
    name: "Gender-wise Needs",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT08: {
    name: "KPI Results",
    exportFormats: ["excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT09: {
    name: "Priority Ranking",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT10: {
    name: "Data Quality Indicators",
    exportFormats: ["excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT11: {
    name: "Previous Studies View",
    exportFormats: [],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT12: {
    name: "Report Sharing Status",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: false,
    requiresSurveyId: false,
  },
  RPT13: {
    name: "Executive Summary",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
    requiresSurveyId: false,
  },
  RPT14: {
    name: "Village Report",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
    requiresSurveyId: false,
  },
  RPT15: {
    name: "Survey & Dashboard Report",
    exportFormats: ["pdf", "excel"],
    requiresStudyId: true,
    requiresSurveyId: true,
  },
};

export interface Report {
  id: string;
  reportType: ReportTypeCode;
  status: ReportStatus;
  title: string;
  studyId: string | null;
  // Set only for survey-scoped types (RPT01/RPT15). surveyTitle is resolved
  // server-side so the list can show which survey a report came from.
  surveyId: string | null;
  surveyTitle: string | null;
  filters: Record<string, unknown>;
  content: Record<string, unknown>;
  generatedBy: string;
  generatedByName: string | null;
  generatedAt: string;
  officerConfirmedBy: string | null;
  officerConfirmedByName: string | null;
  officerConfirmedAt: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedByRole: string | null;
  reviewedAt: string | null;
  archivedAt: string | null;
  exportFormats: ExportFormat[];
}

export interface CreateReportPayload {
  reportType: ReportTypeCode;
  studyId?: string;
  surveyId?: string;
  filters?: Record<string, unknown>;
}

export interface ListReportsParams {
  reportType?: ReportTypeCode;
  status?: ReportStatus;
  studyId?: string;
  surveyId?: string;
}
