import { describe, expect, it } from "vitest";
import type { Need } from "@/services/needs/needs.types";
import { getVerifiedNeedStatusCounts, NO_RECORDED_RESPONSES } from "./dashboard-metrics";

describe("verified dashboard metrics", () => {
  it("keeps genuine zero status counts instead of generating percentages", () => {
    const counts = getVerifiedNeedStatusCounts([] as Need[]);
    expect(counts).toEqual({ publishedCount: 0, draftCount: 0 });
  });

  it("does not invent response totals when no response field is available", () => {
    expect(NO_RECORDED_RESPONSES).toBe(0);
  });
});
