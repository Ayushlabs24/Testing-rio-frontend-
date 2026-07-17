import { describe, expect, it } from "vitest";
import { needLockState } from "@/services/needs/needs.types";

// Mirrors the server-side rule — if the backend gate is changed, this table
// has to change with it or the UI will offer edits the API rejects (or hide
// edits the API would allow).
describe("needLockState", () => {
  it("is editable only in draft", () => {
    expect(needLockState("draft")).toBe("editable");
  });

  it("is locked at every later stage", () => {
    expect(needLockState("evidence_submitted")).toBe("locked");
    expect(needLockState("ai_classified")).toBe("locked");
    expect(needLockState("reviewer_approved")).toBe("locked");
    expect(needLockState("survey_created")).toBe("locked");
    expect(needLockState("survey_published")).toBe("locked");
  });
});
