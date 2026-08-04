import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStudy: vi.fn(),
  listDocuments: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({
      loadErrorTitle: "Couldn't load evidence documents.",
      retry: "Retry",
    })[key] ?? key,
}));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-permission", () => ({ usePermission: () => true }));
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
  evidenceDocumentsService: { listDocuments: mocks.listDocuments },
}));
vi.mock("@/services/reports/reports.service", () => ({
  reportsService: { create: vi.fn() },
}));

import EvidenceDocumentsPage from "./page";

describe("EvidenceDocumentsPage loading errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStudy.mockResolvedValue({
      id: "study-1",
      title: "Study title",
      cycleNumber: 1,
      methodologyVersionId: "methodology-1",
    });
    mocks.listDocuments.mockResolvedValue([]);
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
});
