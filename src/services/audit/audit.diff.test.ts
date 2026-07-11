import { describe, expect, it } from "vitest";
import { diffChanges } from "@/services/audit/audit.diff";

const FIELDS = { name: "Name", isActive: "Active", villages: "Villages" };

describe("diffChanges", () => {
  it("captures before/after only for fields that changed", () => {
    const changes = diffChanges(
      { name: "Old", isActive: true, villages: ["Maple"] },
      { name: "New", isActive: true, villages: ["Maple"] },
      FIELDS,
    );

    expect(changes).toEqual([{ field: "Name", before: "Old", after: "New" }]);
  });

  it("normalises booleans, arrays, and empty values", () => {
    const changes = diffChanges(
      { name: "", isActive: false, villages: [] },
      { name: "Rio", isActive: true, villages: ["Maple", "Oak"] },
      FIELDS,
    );

    expect(changes).toEqual([
      { field: "Name", before: null, after: "Rio" },
      { field: "Active", before: "false", after: "true" },
      { field: "Villages", before: null, after: "Maple, Oak" },
    ]);
  });

  it("preserves field label order and ignores unlisted fields", () => {
    const changes = diffChanges(
      { name: "A", isActive: true, secret: "x" },
      { name: "B", isActive: false, secret: "y" },
      FIELDS,
    );

    expect(changes.map((c) => c.field)).toEqual(["Name", "Active"]);
  });
});
