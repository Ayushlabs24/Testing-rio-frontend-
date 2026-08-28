import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/en.json";
import { NeedSummarySection } from "./need-summary-section";
import type { NeedSummary } from "@/services/needs/need-summary.types";

const getForNeed = vi.fn();
const updateDraft = vi.fn();
const confirm = vi.fn();
const regenerate = vi.fn();

vi.mock("@/services/needs/need-summary.service", () => ({
  needSummaryService: {
    getForNeed: (...a: unknown[]) => getForNeed(...a),
    updateDraft: (...a: unknown[]) => updateDraft(...a),
    confirm: (...a: unknown[]) => confirm(...a),
    regenerate: (...a: unknown[]) => regenerate(...a),
  },
}));

// Every write on this panel is gated on aiReview:approve — the ticket names
// only Human Reviewer, and that role holds `approve` but not `write`. See the
// component's header comment.
let canReview = true;
vi.mock("@/hooks/use-permission", () => ({
  usePermission: (_m: string, action: string) =>
    action === "approve" ? canReview : false,
}));

const SUMMARY: NeedSummary = {
  id: "sum-1",
  needId: "need-1",
  studyId: "study-1",
  needTitle: null,
  status: "DRAFT",
  promptVersion: "need-statement-summary-v1",
  modelName: "gemini-2.5-flash",
  sourceStatement: "The original long description written by the field researcher.",
  sourceLength: 1600,
  aiSummaryText: "A shorter version.",
  reviewerEditedText: null,
  effectiveText: "A shorter version.",
  wasEdited: false,
  triggerSource: "manual_entry",
  verificationWarnings: [],
  generatedAt: "2026-08-25T00:00:00.000Z",
  confirmedBy: null,
  confirmedAt: null,
};

function renderSection() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NeedSummarySection needId="need-1" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  canReview = true;
  getForNeed.mockResolvedValue(SUMMARY);
});

describe("NeedSummarySection", () => {
  it("renders nothing when the need has no summary", async () => {
    getForNeed.mockResolvedValue(null);
    const { container } = renderSection();
    await waitFor(() => expect(getForNeed).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
  });

  it("AC 4 — shows the original description alongside the summary", async () => {
    renderSection();
    expect(await screen.findByDisplayValue("A shorter version.")).toBeInTheDocument();
    expect(
      screen.getByText("The original long description written by the field researcher."),
    ).toBeInTheDocument();
  });

  it("AC 2 — the summary is editable before it is saved", async () => {
    const user = userEvent.setup();
    updateDraft.mockResolvedValue({
      ...SUMMARY,
      reviewerEditedText: "Reviewer version.",
      effectiveText: "Reviewer version.",
      wasEdited: true,
    });
    renderSection();

    const box = await screen.findByDisplayValue("A shorter version.");
    await user.clear(box);
    await user.type(box, "Reviewer version.");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() =>
      expect(updateDraft).toHaveBeenCalledWith("sum-1", "Reviewer version."),
    );
  });

  it("AC 3 — someone who cannot approve gets no buttons and a reason why", async () => {
    canReview = false;
    renderSection();

    const box = await screen.findByDisplayValue("A shorter version.");
    // Read-only: they can still see the summary and the original beside it,
    // which is AC 4, but nothing here is theirs to decide.
    expect(box).toBeDisabled();
    expect(screen.queryByRole("button", { name: /confirm summary/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /save draft/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /regenerate/i })).toBeNull();
    expect(screen.getByText(/a reviewer must confirm this summary/i)).toBeInTheDocument();
  });

  it("AC 3 — confirming is a separate, explicit action", async () => {
    const user = userEvent.setup();
    confirm.mockResolvedValue({ ...SUMMARY, status: "CONFIRMED" });
    renderSection();

    await screen.findByDisplayValue("A shorter version.");
    await user.click(screen.getByRole("button", { name: /confirm summary/i }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith("sum-1"));
    // Nothing was edited, so it must not have written a pointless draft first.
    expect(updateDraft).not.toHaveBeenCalled();
  });

  it("saves an unsaved edit before confirming, so the edited text is what gets signed off", async () => {
    const user = userEvent.setup();
    updateDraft.mockResolvedValue({
      ...SUMMARY,
      reviewerEditedText: "Edited then confirmed.",
      effectiveText: "Edited then confirmed.",
      wasEdited: true,
    });
    confirm.mockResolvedValue({ ...SUMMARY, status: "CONFIRMED" });
    renderSection();

    const box = await screen.findByDisplayValue("A shorter version.");
    await user.clear(box);
    await user.type(box, "Edited then confirmed.");
    await user.click(screen.getByRole("button", { name: /confirm summary/i }));

    await waitFor(() =>
      expect(updateDraft).toHaveBeenCalledWith("sum-1", "Edited then confirmed."),
    );
    expect(confirm).toHaveBeenCalled();
  });

  it("a confirmed summary is read-only and offers no Confirm", async () => {
    getForNeed.mockResolvedValue({
      ...SUMMARY,
      status: "CONFIRMED",
      confirmedAt: "2026-08-25T01:00:00.000Z",
    });
    renderSection();

    const box = await screen.findByDisplayValue("A shorter version.");
    expect(box).toBeDisabled();
    expect(screen.queryByRole("button", { name: /confirm summary/i })).toBeNull();
    expect(screen.getByText(/^Confirmed$/)).toBeInTheDocument();
  });

  it("AC 5 — verification warnings are shown with the offending detail", async () => {
    getForNeed.mockResolvedValue({
      ...SUMMARY,
      verificationWarnings: [
        { code: "NUMBER_INVENTED", detail: "320" },
        { code: "FACT_DROPPED", detail: "Al-Jumum North" },
      ],
    });
    renderSection();

    expect(await screen.findByText(/2 checks need your attention/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The number 320 appears in the summary/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/"Al-Jumum North" is in the original/i)).toBeInTheDocument();
  });

  it("a clean summary shows no warning block", async () => {
    renderSection();
    await screen.findByDisplayValue("A shorter version.");
    expect(screen.queryByText(/need your attention/i)).toBeNull();
  });

  it("a stale summary explains why it is not being used", async () => {
    getForNeed.mockResolvedValue({ ...SUMMARY, status: "STALE" });
    renderSection();
    expect(
      await screen.findByText(/the need description changed after this summary/i),
    ).toBeInTheDocument();
  });

  it("regenerate asks for a fresh suggestion", async () => {
    const user = userEvent.setup();
    regenerate.mockResolvedValue({
      ...SUMMARY,
      aiSummaryText: "Fresh.",
      effectiveText: "Fresh.",
    });
    renderSection();

    await screen.findByDisplayValue("A shorter version.");
    await user.click(screen.getByRole("button", { name: /regenerate/i }));

    await waitFor(() => expect(regenerate).toHaveBeenCalledWith("need-1"));
  });
});
