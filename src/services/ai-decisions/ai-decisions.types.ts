// One Need can classify into multiple domains/sub-domains at once (per
// Ganesh) — this is NOT multiple Needs, just multiple AI suggestions
// against the one Need.
export interface ClassificationSuggestion {
  domains: string[];
  subDomains: string[];
  rationale?: string;
  redactedStatement?: string;
  village?: string;
}

export interface AiDecision {
  id: string;
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
