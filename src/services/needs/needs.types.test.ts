import { describe, expect, it } from "vitest";
import { needLockState } from "@/services/needs/needs.types";

// The full Study.status x role matrix. Mirrors the server-side rule — if the
// backend gate is changed, this table has to change with it or the UI will
// offer edits the API rejects (or hide edits the API would allow).
describe("needLockState", () => {
  it("is editable for any writer while the study is still being built", () => {
    expect(needLockState("draft", "field_researcher")).toBe("editable");
    expect(needLockState("need_captured", "field_researcher")).toBe("editable");
    expect(needLockState("draft", "ngo_admin")).toBe("editable");
  });

  it("is reviewer_only for a non-reviewer once evidence/AI depend on it", () => {
    expect(needLockState("evidence_submitted", "field_researcher")).toBe("reviewer_only");
    expect(needLockState("ai_classified", "field_researcher")).toBe("reviewer_only");
  });

  it("lets a human_reviewer amend at those same statuses", () => {
    expect(needLockState("evidence_submitted", "human_reviewer")).toBe("editable");
    expect(needLockState("ai_classified", "human_reviewer")).toBe("editable");
  });

  // The case most likely to be coded wrong: locked means locked, and the
  // reviewer's elevated rights do not survive their own review.
  it("is locked for everyone once human_reviewed, reviewers included", () => {
    expect(needLockState("human_reviewed", "human_reviewer")).toBe("locked");
    expect(needLockState("human_reviewed", "field_researcher")).toBe("locked");
    expect(needLockState("human_reviewed", "ngo_admin")).toBe("locked");
  });

  it("does not treat an unknown/absent role as a reviewer", () => {
    expect(needLockState("ai_classified", undefined)).toBe("reviewer_only");
    expect(needLockState("ai_classified", "")).toBe("reviewer_only");
  });
});
