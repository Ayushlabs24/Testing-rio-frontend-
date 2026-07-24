export interface ResponseQualityResult {
  id: string;
  needId: string;
  studyId: string;
  /** Null = Consolidated (every Survey Link); set = scoped to just that one link. */
  surveyLinkId: string | null;
  surveyResponseId: string;
  completenessScore: number;
  missingFields: string[];
  confidenceFlag: "standard" | "low";
  isDuplicate: boolean;
  duplicateOfId: string | null;
  assessedAt: string;
}

export interface AiSummary {
  id: string;
  needId: string;
  studyId: string;
  surveyLinkId: string | null;
  summaryText: string;
  responseCount: number;
  generatedAt: string;
}
