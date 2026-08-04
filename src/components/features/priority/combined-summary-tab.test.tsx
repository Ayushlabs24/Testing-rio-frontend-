import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({ useRouter: vi.fn() }));

import { saveAndConfirmCombinedSummary } from "./combined-summary-tab";

describe("saveAndConfirmCombinedSummary", () => {
  const summary = { id: "summary-1", status: "DRAFT" } as never;
  const confirmed = { id: "summary-1", status: "OFFICER_CONFIRMED" } as never;
  const editedJson = { executiveSummary: "Officer-edited summary" };

  it("updates edited JSON before confirming", async () => {
    const calls: string[] = [];
    const update = vi.fn(async () => {
      calls.push("update");
    });
    const confirm = vi.fn(async () => {
      calls.push("confirm");
      return confirmed;
    });

    await expect(
      saveAndConfirmCombinedSummary({
        studyId: "study-1",
        summary,
        editing: true,
        editedJson,
        update,
        confirm,
      }),
    ).resolves.toBe(confirmed);

    expect(calls).toEqual(["update", "confirm"]);
    expect(update).toHaveBeenCalledWith("study-1", "summary-1", editedJson);
    expect(confirm).toHaveBeenCalledWith("study-1", "summary-1");
  });

  it("short-circuits confirmation when update fails", async () => {
    const failure = new Error("update failed");
    const update = vi.fn().mockRejectedValue(failure);
    const confirm = vi.fn();

    await expect(
      saveAndConfirmCombinedSummary({
        studyId: "study-1",
        summary,
        editing: true,
        editedJson,
        update,
        confirm,
      }),
    ).rejects.toBe(failure);

    expect(confirm).not.toHaveBeenCalled();
  });

  it("creates only after update and confirmation", async () => {
    const calls: string[] = [];
    const update = vi.fn(async () => {
      calls.push("update");
    });
    const confirm = vi.fn(async () => {
      calls.push("confirm");
      return confirmed;
    });
    const createReport = vi.fn(async () => {
      calls.push("create");
    });
    await saveAndConfirmCombinedSummary({
      studyId: "study-1",
      summary,
      editing: true,
      editedJson,
      update,
      confirm,
      createReport,
    });
    expect(calls).toEqual(["update", "confirm", "create"]);
  });

  it("does not create when confirmation fails", async () => {
    const failure = new Error("confirm failed");
    const update = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockRejectedValue(failure);
    const createReport = vi.fn();
    await expect(
      saveAndConfirmCombinedSummary({
        studyId: "study-1",
        summary,
        editing: true,
        editedJson,
        update,
        confirm,
        createReport,
      }),
    ).rejects.toBe(failure);
    expect(createReport).not.toHaveBeenCalled();
  });
});
