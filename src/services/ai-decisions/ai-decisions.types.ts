export interface ClassificationSuggestion {
  domains: string[];
  subDomains: string[];
  rationale?: string;
  redactedStatement?: string;
  village?: string;
}

/** RIO-AI-001 — resolved by the backend from the configured thresholds (see
 * MethodologyConfig.aiClassificationSettings). Deliberately NOT re-derived
 * here: hardcoding the bands in this component is exactly what made the
 * acceptance criterion's "configurable threshold" unmeetable. */
export type ConfidenceBand = "standard" | "low" | "very_low" | "not_reported";

export interface AiDecision {
  id: string;
  needId: string;
  studyId: string;
  touchpoint: "need_classification" | "priority_scoring";
  suggestion: ClassificationSuggestion;
  /** 0..1, or `null` when the model classified but reported no confidence.
   * `0` is a different thing — it is the real "AI declined to classify"
   * value — so never render the two the same way. */
  confidence: number | null;
  confidenceBand: ConfidenceBand;
  /** Echoed so the UI can name the threshold ("below 70%") without a second
   * request for the methodology config. */
  confidenceThresholds: { low: number; veryLow: number };
  humanDecision: { decision: string; notes?: string; overrideValue?: unknown } | null;
  createdAt: string;
}

/** A Need can span multiple Domain/Sub-domain pairs (see NeedDomain on the
 * backend) — no limit on how many. */
export type DomainSubDomainPair = { domain: string; subDomain: string };

export interface ReviewDecisionPayload {
  decision: "approved" | "rejected" | "modified";
  notes?: string;
  /** `modified` carries the reviewer's replacement classification. The backend
   * reads `pairs` (see AiReviewApproveBody's domainOverride) — a Need can be
   * classified into several Domain/Sub-domain pairs at once. */
  overrideValue?: { pairs: DomainSubDomainPair[] };
}
