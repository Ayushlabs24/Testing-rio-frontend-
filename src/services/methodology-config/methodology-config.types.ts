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

export type MethodologyStatus = "draft" | "published";

export interface MethodologyConfig {
  id: string;
  version: string;
  status: MethodologyStatus;
  publishedByName: string | null;
  publishedAt: string | null;
  priorityThresholds: PriorityThresholds;
  priorityFactorWeights: PriorityFactorWeight[];
  confidenceFlagSettings: ConfidenceFlagSettings;
  aiClassificationSettings: AiClassificationSettings;
  aiSummarySettings: AiSummarySettings;
  updatedAt: string;
  updatedByName: string | null;
}

// RIO-NFR-017 — one immutable snapshot per edit/publish, newest first.
export interface MethodologyConfigHistoryEntry {
  id: string;
  version: string;
  status: MethodologyStatus;
  changeType: "edit" | "publish";
  priorityThresholds: PriorityThresholds;
  priorityFactorWeights: PriorityFactorWeight[];
  confidenceFlagSettings: ConfidenceFlagSettings;
  aiClassificationSettings: AiClassificationSettings;
  aiSummarySettings: AiSummarySettings;
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
}

/** TEMPORARY — see the MethodologyVersionOption model comment on the
 * backend. Backs the Survey workflow's Methodology Version selector until
 * the real source of versions is clarified. */
export interface MethodologyVersionOption {
  id: string;
  version: string;
}
