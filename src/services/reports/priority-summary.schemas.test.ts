import { describe, expect, it } from "vitest";
import { parsePrioritySummarySnapshot } from "./priority-summary.schemas";

describe("parsePrioritySummarySnapshot", () => {
  it("parses a well-formed snapshot", () => {
    const raw = {
      scope: "VILLAGE",
      evidence: [{ id: "e1" }, { id: "e2" }],
      responseQuality: {
        submittedResponseCount: 10,
        validResponseCount: 8,
        confidenceLevel: "High",
      },
      severity: { overallVillageNeedsIndex: 62.5 },
    };
    expect(parsePrioritySummarySnapshot(raw)).toEqual(raw);
  });

  it("accepts a snapshot with every field absent", () => {
    expect(parsePrioritySummarySnapshot({})).toEqual({});
  });

  it("returns null for a snapshot with the wrong field types", () => {
    const raw = {
      scope: "VILLAGE",
      responseQuality: { submittedResponseCount: "ten" }, // wrong type
    };
    expect(parsePrioritySummarySnapshot(raw)).toBeNull();
  });

  it("returns null for a non-object snapshot", () => {
    expect(parsePrioritySummarySnapshot(null)).toBeNull();
    expect(parsePrioritySummarySnapshot("not an object")).toBeNull();
  });

  it("accepts a null overallVillageNeedsIndex", () => {
    const raw = { severity: { overallVillageNeedsIndex: null } };
    expect(parsePrioritySummarySnapshot(raw)).toEqual(raw);
  });
});
