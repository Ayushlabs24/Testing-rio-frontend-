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
      return summary;
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
      return summary;
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
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach } from "vitest";

const componentMocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
  createReport: vi.fn(),
  listReports: vi.fn(),
  push: vi.fn(),
  generateCombinedSummary: vi.fn(),
  permissions: {
    aiReview: true,
    reportsDashboards: true,
  } as Record<string, boolean>,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: componentMocks.push }),
}));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: (resource: string) => componentMocks.permissions[resource] ?? false,
}));
vi.mock("@/services/reports/combined-report.service", () => ({
  combinedReportService: {
    getContext: componentMocks.getContext,
    updateCombinedSummary: componentMocks.update,
    confirmCombinedSummary: componentMocks.confirm,
    generateCombinedSummary: componentMocks.generateCombinedSummary,
  },
}));
vi.mock("@/services/reports/reports.service", () => ({
  reportsService: {
    create: componentMocks.createReport,
    list: componentMocks.listReports,
  },
}));
import { CombinedSummaryTab } from "./combined-summary-tab";

describe("CombinedSummaryTab", () => {
  const initialOutput = { executiveSummary: "Initial narrative" };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("alert", vi.fn());
    componentMocks.permissions.aiReview = true;
    componentMocks.permissions.reportsDashboards = true;
    componentMocks.getContext.mockResolvedValue({
      confirmedDocumentSummaries: [],
      availableScoreSummaries: [],
      latestCombinedSummary: {
        id: "summary-1",
        status: "DRAFT",
        aiOutputJson: initialOutput,
      },
    });
    componentMocks.listReports.mockResolvedValue([]);
    componentMocks.update.mockResolvedValue(undefined);
    componentMocks.confirm.mockResolvedValue({
      id: "summary-1",
      status: "OFFICER_CONFIRMED",
      aiOutputJson: initialOutput,
    });
    componentMocks.createReport.mockResolvedValue({ id: "report-1" });
  });
  it("disables report creation for a user without report create permission", async () => {
    const user = userEvent.setup();
    componentMocks.permissions.reportsDashboards = false;

    render(<CombinedSummaryTab studyId="study-1" />);

    const button = await screen.findByRole("button", {
      name: "Generate Combined Report",
    });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(componentMocks.createReport).not.toHaveBeenCalled();
  });
  it("persists edited JSON before confirming and creating a combined report", async () => {
    const user = userEvent.setup();
    render(<CombinedSummaryTab studyId="study-1" />);
    await user.click(await screen.findByRole("button", { name: "Edit Draft" }));
    const editor = screen.getByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "Officer-edited narrative");
    await user.click(screen.getByRole("button", { name: "Generate Combined Report" }));
    await waitFor(() =>
      expect(componentMocks.createReport).toHaveBeenCalledWith({
        reportType: "RPT16",
        studyId: "study-1",
      }),
    );
    expect(componentMocks.update).toHaveBeenCalledWith("study-1", "summary-1", {
      executiveSummary: "Officer-edited narrative",
    });
    expect(componentMocks.confirm).toHaveBeenCalledWith("study-1", "summary-1");
  });
  it("does not create a report when saving edited JSON is rejected", async () => {
    const user = userEvent.setup();
    componentMocks.update.mockRejectedValueOnce(new Error("update rejected"));
    render(<CombinedSummaryTab studyId="study-1" />);
    await user.click(await screen.findByRole("button", { name: "Edit Draft" }));
    const editor = screen.getByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "Rejected edit");
    await user.click(screen.getByRole("button", { name: "Generate Combined Report" }));
    await waitFor(() => expect(componentMocks.update).toHaveBeenCalled());
    expect(componentMocks.confirm).not.toHaveBeenCalled();
    expect(componentMocks.createReport).not.toHaveBeenCalled();
  });
});
