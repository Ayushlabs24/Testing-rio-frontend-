export interface PriorityThresholds {
  criticalSeverity: number;
  highSeverity: number;
  mediumSeverity: number;
  equityHighSeverity: number;
}

export interface PriorityFactorWeight {
  key: string;
  label: string;
  weight: number;
}

export interface ConfidenceFlagSettings {
  dontKnowRatioThreshold: number;
  minRespondentsForStandardConfidence: number;
}

/** RIO-AI-001 — the thresholds below which an AI classification suggestion is
 * flagged for closer reviewer attention. Both on the 0..1 scale
 * AiDecision.confidence uses, NOT the 0-100 severity scale PriorityThresholds
 * uses. The reviewer UI never reads these directly — the backend resolves the
 * band and sends it — they exist here so the Methodology Configuration screen
 * can edit them. */
export interface AiClassificationSettings {
  lowConfidenceThreshold: number;
  veryLowConfidenceThreshold: number;
}

/** RIO-AI-003 — when a need description is long enough to be summarised, and
 * how long the suggested summary may be. `statementLengthThreshold` is a
 * character count and is deliberately the same for every language (client
 * decision, 25 Aug 2026): a word count behaves very differently in Arabic,
 * which is more compact per character than English. */
export interface AiSummarySettings {
  statementLengthThreshold: number;
  maxSummaryChars: number;
}

/** RIO-FR-003 — how a raw figure becomes the 0-100 value a factor weight
 * multiplies. `priorityFactorWeights` says a factor is worth 12%; this says
 * what "450 affected people" is worth out of 100. */
export interface FactorRange {
  floor: number;
  ceiling: number;
}

/** One strategic axis from the methodology's Factors & Multipliers sheet —
 * `value` (0-100) is the only field this screen lets a System Admin tune;
 * `domains`/`questionIds` are the structural mapping set when the axis was
 * defined, shown for context only. */
export interface StrategicAxis {
  key: string;
  label: string;
  value: number;
  domains: string[];
  questionIds: string[];
}

export interface PriorityFactorScales {
  /** Urgency is a human-chosen level, so it maps by name rather than by range. */
  urgency: Record<string, number>;
  affectedPopulation: FactorRange;
  geographicCoverage: FactorRange;
  /** How many other needs share a theme with this one. */
  frequency: FactorRange;
  strategicAxes: StrategicAxis[];
  equitySpreadThreshold: number;
}

export type MethodologyStatus = "draft" | "pending_approval" | "approved" | "published";

export interface MethodologyConfig {
  id: string;
  version: string;
  status: MethodologyStatus;
  publishedByName: string | null;
  publishedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  priorityThresholds: PriorityThresholds;
  priorityFactorWeights: PriorityFactorWeight[];
  confidenceFlagSettings: ConfidenceFlagSettings;
  aiClassificationSettings: AiClassificationSettings;
  aiSummarySettings: AiSummarySettings;
  priorityFactorScales: PriorityFactorScales;
  updatedAt: string;
  updatedByName: string | null;
}

// RIO-NFR-017 — one immutable snapshot per edit/approve/reject/publish, newest first.
export interface MethodologyConfigHistoryEntry {
  id: string;
  version: string;
  status: MethodologyStatus;
  changeType: "edit" | "approve" | "reject" | "publish";
  priorityThresholds: PriorityThresholds;
  priorityFactorWeights: PriorityFactorWeight[];
  confidenceFlagSettings: ConfidenceFlagSettings;
  aiClassificationSettings: AiClassificationSettings;
  aiSummarySettings: AiSummarySettings;
  priorityFactorScales: PriorityFactorScales;
  changedByName: string | null;
  changedAt: string;
}

export interface UpdateMethodologyConfigPayload {
  version?: string;
  priorityThresholds?: Partial<PriorityThresholds>;
  priorityFactorWeights?: Array<{ key: string; weight: number }>;
  confidenceFlagSettings?: Partial<ConfidenceFlagSettings>;
  aiClassificationSettings?: Partial<AiClassificationSettings>;
  aiSummarySettings?: Partial<AiSummarySettings>;
  priorityFactorScales?: Partial<PriorityFactorScales>;
}

/** TEMPORARY — see the MethodologyVersionOption model comment on the
 * backend. Backs the Survey workflow's Methodology Version selector until
 * the real source of versions is clarified.
 *
 * `name` is the human-readable label ("Village Needs Methodology v5.0 -
 * ..."), same one the New Study screen shows for the same published
 * MethodologyVersion row — use it for display. `version` stays what gets
 * persisted onto Survey.methodologyVersion, unchanged. */
export interface MethodologyVersionOption {
  id: string;
  version: string;
  name: string;
}
