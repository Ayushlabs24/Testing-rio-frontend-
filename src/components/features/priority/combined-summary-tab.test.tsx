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
        dirty: true,
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
        dirty: true,
        editedJson,
        update,
        confirm,
      }),
    ).rejects.toBe(failure);

    expect(confirm).not.toHaveBeenCalled();
  });

  it("allows report creation only after update and confirmation", async () => {
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
      dirty: true,
      editedJson,
      update,
      confirm,
    });
    await createReport();
    expect(calls).toEqual(["update", "confirm", "create"]);
  });

  it("does not let the caller create when confirmation fails", async () => {
    const failure = new Error("confirm failed");
    const update = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockRejectedValue(failure);
    const createReport = vi.fn();
    await expect(
      saveAndConfirmCombinedSummary({
        studyId: "study-1",
        summary,
        dirty: true,
        editedJson,
        update,
        confirm,
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
    "aiReview.write": true,
    "reportsDashboards.create": true,
  } as Record<string, boolean>,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: componentMocks.push }),
}));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: (module: string, action: string) =>
    componentMocks.permissions[`${module}.${action}`] ?? false,
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
    componentMocks.permissions["aiReview.write"] = true;
    componentMocks.permissions["reportsDashboards.create"] = true;
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
  it("disables and defensively blocks reports without create permission", async () => {
    componentMocks.permissions["reportsDashboards.create"] = false;

    render(<CombinedSummaryTab studyId="study-1" />);

    const button = await screen.findByRole("button", {
      name: "Generate Combined Report",
    });
    expect(button).toBeDisabled();
    button.removeAttribute("disabled");
    button.click();
    expect(componentMocks.createReport).not.toHaveBeenCalled();
  });
  it("disables and defensively blocks draft reports without AI write", async () => {
    const user = userEvent.setup();
    componentMocks.permissions["aiReview.write"] = false;

    render(<CombinedSummaryTab studyId="study-1" />);

    const button = await screen.findByRole("button", {
      name: "Generate Combined Report",
    });
    expect(button).toBeDisabled();
    await user.click(button);
    button.removeAttribute("disabled");
    button.click();
    expect(componentMocks.update).not.toHaveBeenCalled();
    expect(componentMocks.confirm).not.toHaveBeenCalled();
    expect(componentMocks.createReport).not.toHaveBeenCalled();
  });
  it("allows report creation from a confirmed summary without AI write permission", async () => {
    const user = userEvent.setup();
    componentMocks.permissions["aiReview.write"] = false;
    componentMocks.getContext.mockResolvedValue({
      confirmedDocumentSummaries: [],
      availableScoreSummaries: [],
      latestCombinedSummary: {
        id: "summary-1",
        status: "OFFICER_CONFIRMED",
        aiOutputJson: initialOutput,
      },
    });

    render(<CombinedSummaryTab studyId="study-1" />);

    const button = await screen.findByRole("button", {
      name: "Generate Combined Report",
    });
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(() =>
      expect(componentMocks.createReport).toHaveBeenCalledWith({
        reportType: "RPT16",
        studyId: "study-1",
      }),
    );
    expect(componentMocks.update).not.toHaveBeenCalled();
    expect(componentMocks.confirm).not.toHaveBeenCalled();
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
  it("persists a dirty edit after returning to preview before report generation", async () => {
    const user = userEvent.setup();
    render(<CombinedSummaryTab studyId="study-1" />);
    await user.click(await screen.findByRole("button", { name: "Edit Draft" }));
    const editor = screen.getByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "Previewed officer edit");
    await user.click(screen.getByRole("button", { name: "Preview View" }));
    await user.click(screen.getByRole("button", { name: "Generate Combined Report" }));
    await waitFor(() =>
      expect(componentMocks.createReport).toHaveBeenCalledWith({
        reportType: "RPT16",
        studyId: "study-1",
      }),
    );
    expect(componentMocks.update).toHaveBeenCalledWith("study-1", "summary-1", {
      executiveSummary: "Previewed officer edit",
    });
  });

  it("keeps the locally confirmed state when report creation fails", async () => {
    const user = userEvent.setup();
    componentMocks.createReport.mockRejectedValueOnce(new Error("create rejected"));
    render(<CombinedSummaryTab studyId="study-1" />);
    await user.click(
      await screen.findByRole("button", { name: "Generate Combined Report" }),
    );
    await waitFor(() => expect(vi.mocked(alert)).toHaveBeenCalledWith("create rejected"));
    expect(screen.getByText("CONFIRMED & SAVED")).toBeInTheDocument();
  });

  it("cross-disables and defensively rejects report generation while save is pending", async () => {
    componentMocks.confirm.mockImplementationOnce(() => new Promise(() => undefined));
    const user = userEvent.setup();
    render(<CombinedSummaryTab studyId="study-1" />);
    await user.click(await screen.findByRole("button", { name: "Save Summary" }));
    await waitFor(() => expect(componentMocks.confirm).toHaveBeenCalledTimes(1));
    const generate = screen.getByRole("button", { name: "Generate Combined Report" });
    expect(generate).toBeDisabled();
    generate.removeAttribute("disabled");
    generate.click();
    expect(componentMocks.confirm).toHaveBeenCalledTimes(1);
    expect(componentMocks.createReport).not.toHaveBeenCalled();
  });
});
