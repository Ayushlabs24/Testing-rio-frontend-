import type { ConfidenceBand } from "@/services/ai-decisions/ai-decisions.types";

/**
 * RIO-AI-001 — presentation rules for an AI suggestion's confidence band.
 *
 * The band itself is resolved on the backend, next to the configurable
 * thresholds it depends on (MethodologyConfig.aiClassificationSettings), and
 * arrives on the AiDecision/Need. Nothing here re-derives it — re-deriving it
 * from hardcoded 0.7/0.4 literals in the reviewer component is precisely what
 * left "below a configurable threshold" impossible to satisfy.
 *
 * This file only answers "how does each band look", which is genuinely a
 * frontend concern.
 */

/** Bands that should pull the reviewer's attention. Mirrors
 * isFlaggedConfidence() on the backend — kept in sync by the shared band
 * vocabulary, not by duplicating any threshold. */
export function isFlaggedConfidence(band: ConfidenceBand | null): boolean {
  return band !== null && band !== "standard";
}

/** Tailwind text colour per band. `not_reported` gets the muted treatment
 * rather than a colour, because there is no number to be alarmed about — the
 * accompanying badge is what carries the "look closer" signal. */
export function confidenceTextClass(band: ConfidenceBand | null): string {
  switch (band) {
    case "standard":
      return "text-success";
    case "low":
      return "text-warning";
    case "very_low":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

/** Tailwind fill for the confidence meter. */
export function confidenceBarClass(band: ConfidenceBand | null): string {
  switch (band) {
    case "standard":
      return "bg-success";
    case "low":
      return "bg-warning";
    case "very_low":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/40";
  }
}

/** Badge variant for the "needs closer review" flag. */
export function confidenceBadgeVariant(
  band: ConfidenceBand | null,
): "destructive" | "outline" {
  return band === "very_low" ? "destructive" : "outline";
}

/** The i18n key naming this band, under the AI classification namespace. */
export function confidenceBandLabelKey(band: ConfidenceBand): string {
  switch (band) {
    case "standard":
      return "confidenceStandard";
    case "low":
      return "confidenceLow";
    case "very_low":
      return "confidenceVeryLow";
    case "not_reported":
      return "confidenceNotReported";
  }
}

/** 0..1 → a whole percentage for display. `null` has no percentage — callers
 * must render the "not reported" wording instead of substituting a number. */
export function confidencePercent(confidence: number | null): number | null {
  return confidence === null ? null : Math.round(confidence * 100);
}
