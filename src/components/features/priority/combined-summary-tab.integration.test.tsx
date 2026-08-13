import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) =>
    ({
      "summary.editDraft": "Edit Draft",
      "summary.generateReport": "Generate Combined Report",
    })[key] ?? key,
}));

const serviceMocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
  listReports: vi.fn(),
  createReport: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-permission", () => ({ usePermission: () => true }));
vi.mock("@/services/reports/combined-report.service", () => ({
  combinedReportService: {
    getContext: serviceMocks.getContext,
    updateCombinedSummary: serviceMocks.update,
    confirmCombinedSummary: serviceMocks.confirm,
  },
}));
vi.mock("@/services/reports/reports.service", () => ({
  reportsService: {
    list: serviceMocks.listReports,
    create: serviceMocks.createReport,
  },
}));

import { CombinedSummaryTab } from "./combined-summary-tab";

afterEach(() => vi.resetAllMocks());

describe("CombinedSummaryTab report generation", () => {
  it("persists the edited draft before confirming and creating RPT16", async () => {
    const calls: string[] = [];
    const draft = {
      id: "summary-1",
      status: "DRAFT",
      aiOutputJson: { executiveSummary: "AI draft" },
      officerEditedOutputJson: null,
    };
    serviceMocks.getContext.mockResolvedValue({
      availableScoreSummaries: [],
      confirmedDocumentSummaries: [],
      latestCombinedSummary: draft,
    });
    serviceMocks.listReports.mockResolvedValue([]);
    serviceMocks.update.mockImplementation(async () => {
      calls.push("update");
      return draft;
    });
    serviceMocks.confirm.mockImplementation(async () => {
      calls.push("confirm");
      return { ...draft, status: "OFFICER_CONFIRMED" };
    });
    serviceMocks.createReport.mockImplementation(async () => {
      calls.push("create");
      return { id: "report-1" };
    });

    const user = userEvent.setup();
    render(<CombinedSummaryTab studyId="study-1" />);

    await user.click(await screen.findByRole("button", { name: "Edit Draft" }));
    const editor = screen.getByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "Officer edit");
    await user.click(screen.getByRole("button", { name: "Generate Combined Report" }));

    await waitFor(() => expect(calls).toEqual(["update", "confirm", "create"]));
    expect(serviceMocks.update).toHaveBeenCalledWith("study-1", "summary-1", {
      executiveSummary: "Officer edit",
    });
    expect(serviceMocks.createReport).toHaveBeenCalledWith({
      reportType: "RPT16",
      studyId: "study-1",
    });
  });
});
