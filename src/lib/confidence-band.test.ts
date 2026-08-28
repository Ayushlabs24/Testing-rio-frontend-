import { describe, it, expect } from "vitest";
import {
  confidenceBandLabelKey,
  confidenceBadgeVariant,
  confidenceBarClass,
  confidencePercent,
  confidenceTextClass,
  isFlaggedConfidence,
} from "@/lib/confidence-band";

describe("isFlaggedConfidence", () => {
  it("does not flag a standard-confidence suggestion", () => {
    expect(isFlaggedConfidence("standard")).toBe(false);
  });

  it("flags low and very low", () => {
    expect(isFlaggedConfidence("low")).toBe(true);
    expect(isFlaggedConfidence("very_low")).toBe(true);
  });

  it("flags an unreported confidence — it is not the same as a good one", () => {
    expect(isFlaggedConfidence("not_reported")).toBe(true);
  });

  it("does not flag a Need that has never been classified", () => {
    // `null` band means no classification has run, so there is no suggestion
    // to be unsure about. Flagging it would fill the reviewer's low-confidence
    // filter with Needs that have nothing to review.
    expect(isFlaggedConfidence(null)).toBe(false);
  });
});

describe("confidencePercent", () => {
  it("converts the 0..1 scale to a whole percentage", () => {
    expect(confidencePercent(0.83)).toBe(83);
  });

  it("keeps a genuine zero as 0, not null", () => {
    // 0 is the "AI declined to classify" value and must still render a number.
    expect(confidencePercent(0)).toBe(0);
  });

  it("returns null for an unreported confidence so callers cannot print a number", () => {
    expect(confidencePercent(null)).toBeNull();
  });
});

describe("band presentation", () => {
  it("gives each band a distinct text colour", () => {
    const classes = (["standard", "low", "very_low", "not_reported"] as const).map(
      confidenceTextClass,
    );
    expect(new Set(classes).size).toBe(4);
  });

  it("gives each band a distinct bar fill", () => {
    const classes = (["standard", "low", "very_low", "not_reported"] as const).map(
      confidenceBarClass,
    );
    expect(new Set(classes).size).toBe(4);
  });

  it("reserves the destructive badge for very low confidence", () => {
    expect(confidenceBadgeVariant("very_low")).toBe("destructive");
    expect(confidenceBadgeVariant("low")).toBe("outline");
    expect(confidenceBadgeVariant("not_reported")).toBe("outline");
  });

  it("maps every band to its own message key", () => {
    const keys = (["standard", "low", "very_low", "not_reported"] as const).map(
      confidenceBandLabelKey,
    );
    expect(new Set(keys).size).toBe(4);
  });
});
