import { describe, expect, it } from "vitest";
import { parseRawEvidenceList } from "./evidence.schemas";

describe("parseRawEvidenceList", () => {
  it("returns an empty list for a non-array response", () => {
    expect(parseRawEvidenceList(null)).toEqual([]);
    expect(parseRawEvidenceList({ id: "not-a-list" })).toEqual([]);
  });

  it("passes through well-formed items unchanged", () => {
    const items = [
      { id: "e1", fileName: "report.pdf", fileType: "pdf", uploadedAt: "2026-01-01" },
    ];
    expect(parseRawEvidenceList(items)).toEqual(items);
  });

  it("drops only the malformed item, keeping the rest of the list", () => {
    const items = [
      { id: "e1", fileName: "good.pdf", isIncludedInReport: true },
      { id: "e2", fileName: "bad.pdf", isIncludedInReport: "yes" }, // wrong type
      { id: "e3", fileName: "also-good.pdf", isIncludedInReport: false },
    ];
    const result = parseRawEvidenceList(items);
    expect(result.map((r) => r.id)).toEqual(["e1", "e3"]);
  });

  it("accepts an item with every field absent", () => {
    expect(parseRawEvidenceList([{}])).toEqual([{}]);
  });
});
