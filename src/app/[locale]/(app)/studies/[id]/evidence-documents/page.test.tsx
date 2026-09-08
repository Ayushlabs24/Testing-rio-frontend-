import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStudy: vi.fn(),
  listDocuments: vi.fn(),
  toggleInclusion: vi.fn(),
  generateDocumentSummary: vi.fn(),
  confirmDocumentSummary: vi.fn(),
  updateDocumentSummary: vi.fn(),
  createReport: vi.fn(),
  push: vi.fn(),
  permissions: {
    "dataCollection.write": true,
    "aiReview.write": true,
    "reportsDashboards.create": true,
  } as Record<string, boolean>,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      loadErrorTitle: "Couldn't load evidence documents.",
      actionErrorTitle: "Couldn't update the evidence document.",
      retry: "Retry",
    })[key] ?? key,
  useLocale: () => "en",
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-permission", () => ({
  usePermission: (module: string, action: string) =>
    mocks.permissions[`${module}.${action}`] ?? false,
}));
vi.mock("@/components/common/page-container", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/common/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/components/common/back-button", () => ({
  BackButton: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("@/components/layout/permission-guard", () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/services/studies/studies.service", () => ({
  studiesService: { getById: mocks.getStudy },
}));
vi.mock("@/services/evidence/evidence-documents.service", () => ({
  evidenceDocumentsService: {
    listDocuments: mocks.listDocuments,
    toggleInclusion: mocks.toggleInclusion,
    generateDocumentSummary: mocks.generateDocumentSummary,
    confirmDocumentSummary: mocks.confirmDocumentSummary,
    updateDocumentSummary: mocks.updateDocumentSummary,
  },
}));
vi.mock("@/services/reports/reports.service", () => ({
  reportsService: { create: mocks.createReport },
}));

import EvidenceDocumentsPage from "./page";

describe("EvidenceDocumentsPage loading errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions["dataCollection.write"] = true;
    mocks.permissions["aiReview.write"] = true;
    mocks.permissions["reportsDashboards.create"] = true;
    mocks.getStudy.mockResolvedValue({
      id: "study-1",
      title: "Study title",
      cycleNumber: 1,
      methodologyVersionId: "methodology-1",
    });
    mocks.listDocuments.mockResolvedValue([]);
    mocks.toggleInclusion.mockResolvedValue(undefined);
    mocks.generateDocumentSummary.mockResolvedValue({
      id: "draft-summary",
      status: "DRAFT",
      aiOutputJson: { summary: "Draft evidence" },
      officerEditedOutputJson: null,
    });
    mocks.confirmDocumentSummary.mockResolvedValue({
      id: "draft-summary",
      status: "OFFICER_CONFIRMED",
    });
    mocks.createReport.mockResolvedValue({ id: "report-1" });
  });

  it("shows a loading error instead of the empty state and retries the list request", async () => {
    const user = userEvent.setup();
    mocks.listDocuments
      .mockRejectedValueOnce(new Error("Evidence service unavailable."))
      .mockResolvedValue([]);

    const params = Promise.resolve({ id: "study-1" });
    await act(async () => {
      render(<EvidenceDocumentsPage params={params} />);
      await params;
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load evidence documents.");
    expect(alert).toHaveTextContent("Evidence service unavailable.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(
      screen.queryByText("No supporting evidence documents uploaded yet."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("No supporting evidence documents uploaded yet."),
    ).toBeInTheDocument();
    expect(mocks.listDocuments).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  const document = {
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
  };

  it("blocks every standalone mutation for an action-aware read-only user", async () => {
    mocks.permissions["dataCollection.write"] = false;
    mocks.permissions["aiReview.write"] = false;
    mocks.permissions["reportsDashboards.create"] = false;
    mocks.listDocuments.mockResolvedValue([document]);
    const params = Promise.resolve({ id: "study-1" });
    await act(async () => {
      render(<EvidenceDocumentsPage params={params} />);
      await params;
    });

    const inclusion = await screen.findByRole("switch");
    expect(inclusion).toBeDisabled();
    inclusion.removeAttribute("disabled");
    inclusion.click();
    expect(mocks.toggleInclusion).not.toHaveBeenCalled();

    const summary = screen.getByRole("button", { name: "Summary" });
    expect(summary).toBeDisabled();
    summary.removeAttribute("disabled");
    summary.click();
    expect(mocks.generateDocumentSummary).not.toHaveBeenCalled();

    const report = screen.getByRole("button", {
      name: "Generate Document-Based Report",
    });
    expect(report).toBeDisabled();
    report.removeAttribute("disabled");
    report.click();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("keeps all authorized standalone mutation controls enabled", async () => {
    mocks.listDocuments.mockResolvedValue([document]);
    const params = Promise.resolve({ id: "study-1" });
    await act(async () => {
      render(<EvidenceDocumentsPage params={params} />);
      await params;
    });

    expect(await screen.findByRole("switch")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Summary" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Generate Document-Based Report" }),
    ).toBeEnabled();
  });

  it("defensively blocks summary confirmation after AI permission is revoked", async () => {
    mocks.listDocuments.mockResolvedValue([document]);
    const params = Promise.resolve({ id: "study-1" });
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<EvidenceDocumentsPage params={params} />);
      await params;
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Summary" }));
    expect(
      await screen.findByRole("button", { name: "Officer Confirm Summary" }),
    ).toBeEnabled();

    mocks.permissions["aiReview.write"] = false;
    view.rerender(<EvidenceDocumentsPage params={params} />);

    const confirmSummary = screen.getByRole("button", {
      name: "Officer Confirm Summary",
    });
    expect(confirmSummary).toBeDisabled();
    confirmSummary.removeAttribute("disabled");
    confirmSummary.click();
    expect(mocks.confirmDocumentSummary).not.toHaveBeenCalled();
  });

  it("keeps the loaded table visible when inclusion fails", async () => {
    mocks.listDocuments.mockResolvedValue([document]);
    mocks.toggleInclusion.mockRejectedValueOnce(new Error("Inclusion failed."));
    const params = Promise.resolve({ id: "study-1" });
    await act(async () => {
      render(<EvidenceDocumentsPage params={params} />);
      await params;
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("switch"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Inclusion failed."),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't update the evidence document.",
    );
    expect(screen.getByText("Field report")).toBeInTheDocument();
    expect(
      screen.queryByText("Couldn't load evidence documents."),
    ).not.toBeInTheDocument();
  });
});
