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
    dataCollection: true,
    aiReview: true,
    reportsDashboards: true,
  } as Record<string, boolean>,
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: (resource: string) => mocks.permissions[resource] ?? false,
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
    mocks.permissions.dataCollection = true;
    mocks.permissions.aiReview = true;
    mocks.permissions.reportsDashboards = true;
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

  it("disables evidence inclusion without data write permission", async () => {
    const user = userEvent.setup();
    mocks.permissions.dataCollection = false;
    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const inclusion = await screen.findByRole("switch");
    expect(inclusion).toBeDisabled();
    await user.click(inclusion);
    expect(mocks.toggleInclusion).not.toHaveBeenCalled();
  });

  it("disables document report creation without report create permission", async () => {
    const user = userEvent.setup();
    mocks.permissions.reportsDashboards = false;
    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const createReport = await screen.findByRole("button", {
      name: "Generate Document-Based Report",
    });
    expect(createReport).toBeDisabled();
    await user.click(createReport);
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("disables summary confirmation when AI permission is revoked", async () => {
    const user = userEvent.setup();
    const view = render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);
    await user.click(await screen.findByRole("button", { name: "Summary" }));
    expect(await screen.findByRole("button", { name: "Save Summary" })).toBeEnabled();

    mocks.permissions.aiReview = false;
    view.rerender(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    const confirmSummary = screen.getByRole("button", { name: "Save Summary" });
    expect(confirmSummary).toBeDisabled();
    await user.click(confirmSummary);
    expect(mocks.confirmDocumentSummary).not.toHaveBeenCalled();
  });

  it("keeps authorized inclusion and report controls available", async () => {
    render(<DocumentBasedSummaryTab studyId="study-1" needId="need-1" />);

    expect(await screen.findByRole("switch")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Generate Document-Based Report" }),
    ).toBeEnabled();
  });
});
