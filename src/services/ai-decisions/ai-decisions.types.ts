export interface AiDecision {
  id: string;
  studyId: string;
  touchpoint: "need_classification" | "priority_scoring";
  // RIO-FR-003: still a placeholder on the backend — shape isn't final, so
  // this stays loosely typed rather than assuming real classification
  // fields (domain/subDomain) that don't exist yet.
  suggestion: Record<string, unknown>;
  confidence: number;
  humanDecision: Record<string, unknown> | null;
  createdAt: string;
}
