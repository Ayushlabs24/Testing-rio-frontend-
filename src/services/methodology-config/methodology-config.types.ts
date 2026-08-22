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
  changedByName: string | null;
  changedAt: string;
}

export interface UpdateMethodologyConfigPayload {
  version?: string;
  priorityThresholds?: Partial<PriorityThresholds>;
  priorityFactorWeights?: Array<{ key: string; weight: number }>;
  confidenceFlagSettings?: Partial<ConfidenceFlagSettings>;
}

/** TEMPORARY — see the MethodologyVersionOption model comment on the
 * backend. Backs the Survey workflow's Methodology Version selector until
 * the real source of versions is clarified. */
export interface MethodologyVersionOption {
  id: string;
  version: string;
}
