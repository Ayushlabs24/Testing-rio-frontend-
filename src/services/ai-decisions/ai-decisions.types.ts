export interface ClassificationSuggestion {
  domains: string[];
  subDomains: string[];
  rationale?: string;
  redactedStatement?: string;
  village?: string;
}

export interface AiDecision {
  id: string;
  needId: string;
  studyId: string;
  touchpoint: "need_classification" | "priority_scoring";
  suggestion: ClassificationSuggestion;
  confidence: number;
  humanDecision: { decision: string; notes?: string; overrideValue?: unknown } | null;
  createdAt: string;
}

export interface ReviewDecisionPayload {
  decision: "approved" | "rejected" | "modified";
  notes?: string;
  overrideValue?: { domains: string[]; subDomains: string[] };
}
