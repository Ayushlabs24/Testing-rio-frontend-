import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  toggleInclusion: vi.fn(),
  generateDocumentSummary: vi.fn(),
  confirmDocumentSummary: vi.fn(),
  createReport: vi.fn(),
  push: vi.fn(),
  permissions: {
    "dataCollection.write": true,
    "priorityScoring.write": true,
    "reportsDashboards.create": true,
  } as Record<string, boolean>,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) =>
    ({
      loadErrorTitle: "Couldn't load evidence documents.",
      actionErrorTitle: "Couldn't update the evidence document.",
      retry: "Retry",
      generateReportButton: "Generate Document-Based Report",
      noDocuments: "No supporting evidence documents uploaded yet for this study.",
      saveSummaryButton: "Save Summary",
      "sections.summary": "Summary",
    })[key] ?? key,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: (module: string, action: string) =>
    mocks.permissions[`${module}.${action}`] ?? false,
}));
vi.mock("@/services/evidence/evidence-documents.service", () => ({
  evidenceDocumentsService: {
    listDocuments: mocks.listDocuments,
    toggleInclusion: mocks.toggleInclusion,
    generateDocumentSummary: mocks.generateDocumentSummary,
    confirmDocumentSummary: mocks.confirmDocumentSummary,
  },
}));
vi.mock("@/services/reports/reports.service", () => ({
  reportsService: { create: mocks.createReport },
}));

import { DocumentBasedSummaryTab } from "./document-based-summary-tab";

describe("DocumentBasedSummaryTab mutation permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions["dataCollection.write"] = true;
    mocks.permissions["priorityScoring.write"] = true;
    mocks.permissions["reportsDashboards.create"] = true;
    mocks.listDocuments.mockResolvedValue([
      {
        id: "doc-1",
        title: "Field report",
        fileName: "field-report.pdf",
        sourceReferenceId: "REF-1",
        documentType: "FIELD_REPORT",
        parsingStatus: "PARSED",
        isIncludedInCombinedReport: false,
        summaries: [
          {
            id: "summary-1",
            status: "OFFICER_CONFIRMED",
            generatedAt: "2026-08-04T00:00:00.000Z",
            aiOutputJson: { summary: "Confirmed evidence" },
          },
        ],
      },
    ]);
    mocks.toggleInclusion.mockResolvedValue(undefined);
    mocks.generateDocumentSummary.mockResolvedValue({
      id: "draft-summary",
      status: "DRAFT",
      generatedAt: "2026-08-04T00:00:00.000Z",
      aiOutputJson: { summary: "Draft evidence" },
      officerEditedOutputJson: null,
    });
    mocks.confirmDocumentSummary.mockResolvedValue(undefined);
    mocks.createReport.mockResolvedValue({ id: "report-1" });
  });

  it("disables and defensively blocks inclusion without data write permission", async () => {
    mocks.permissions["dataCollection.write"] = false;
    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const inclusion = await screen.findByRole("switch");
    expect(inclusion).toBeDisabled();
    inclusion.removeAttribute("disabled");
    inclusion.click();
    expect(mocks.toggleInclusion).not.toHaveBeenCalled();
  });

  it("disables and defensively blocks reports without create permission", async () => {
    mocks.permissions["reportsDashboards.create"] = false;
    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const createReport = await screen.findByRole("button", {
      name: "Generate Document-Based Report",
    });
    expect(createReport).toBeDisabled();
    createReport.removeAttribute("disabled");
    createReport.click();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("disables summary confirmation when AI permission is revoked", async () => {
    const user = userEvent.setup();
    const view = render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);
    await user.click(await screen.findByRole("button", { name: "Summary" }));
    expect(await screen.findByRole("button", { name: "Save Summary" })).toBeEnabled();

    mocks.permissions["priorityScoring.write"] = false;
    view.rerender(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const confirmSummary = screen.getByRole("button", { name: "Save Summary" });
    expect(confirmSummary).toBeDisabled();
    confirmSummary.removeAttribute("disabled");
    confirmSummary.click();
    expect(mocks.confirmDocumentSummary).not.toHaveBeenCalled();
  });

  it("keeps authorized inclusion and report controls available", async () => {
    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    expect(await screen.findByRole("switch")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Generate Document-Based Report" }),
    ).toBeEnabled();
  });

  it("shows a loading error instead of the empty state and retries the list request", async () => {
    const user = userEvent.setup();
    mocks.listDocuments
      .mockRejectedValueOnce(new Error("Evidence service unavailable."))
      .mockResolvedValue([]);

    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load evidence documents.");
    expect(alert).toHaveTextContent("Evidence service unavailable.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(
      screen.queryByText("No supporting evidence documents uploaded yet for this study."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText(
        "No supporting evidence documents uploaded yet for this study.",
      ),
    ).toBeInTheDocument();
    expect(mocks.listDocuments).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the loaded table visible when inclusion fails", async () => {
    const user = userEvent.setup();
    mocks.toggleInclusion.mockRejectedValueOnce(new Error("Inclusion failed."));

    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    await user.click(await screen.findByRole("switch"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't update the evidence document.");
    expect(alert).toHaveTextContent("Inclusion failed.");
    expect(screen.getAllByText("Field report").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Couldn't load evidence documents."),
    ).not.toBeInTheDocument();
  });
});
