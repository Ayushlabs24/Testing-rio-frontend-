import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import { OrganizationConsentCard } from "@/components/features/settings/organization-consent-card";
import { consentService } from "@/services/consent/consent.service";

/**
 * RIO-DATA-001 AC2 — "the acceptance date and policy version are stored".
 * This card is where that record is surfaced, and the thing worth pinning is
 * that the two consents are reported *independently*: an org can be current
 * on one and outstanding on the other, and showing them as a single combined
 * state would hide exactly the case the consent gate acts on.
 */

type Messages = Record<string, unknown>;

function lookup(namespace: string, key: string): string {
  const ns = namespace
    .split(".")
    .reduce<Messages | string | undefined>(
      (acc, part) =>
        (acc as Messages | undefined)?.[part] as Messages | string | undefined,
      en as Messages,
    );
  const value = (ns as Messages | undefined)?.[key];
  return typeof value === "string" ? value : key;
}

const NS = "app.settings.organization.consent";
const t = (key: string) => lookup(NS, key);

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => lookup(namespace, key),
}));

vi.mock("@/services/consent/consent.service", () => ({
  consentService: { getOrganizationStatus: vi.fn() },
}));

const BOTH_ACCEPTED = {
  usePolicy: { version: "v1", acceptedAt: "2026-08-06T09:30:00.000Z" },
  dataSharing: { version: "v1", acceptedAt: "2026-08-06T09:30:00.000Z" },
  acceptedByName: "Org Admin",
  acceptedByEmail: "admin@demo-ngo.org",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrganizationConsentCard", () => {
  it("shows the stored version and acceptance date for each consent", async () => {
    vi.mocked(consentService.getOrganizationStatus).mockResolvedValue(BOTH_ACCEPTED);
    render(<OrganizationConsentCard />);

    expect(await screen.findByText(t("usePolicyLabel"))).toBeInTheDocument();
    expect(screen.getByText(t("dataSharingLabel"))).toBeInTheDocument();
    expect(screen.getAllByText(t("versionLabel"))).toHaveLength(2);
    expect(screen.getAllByText("v1")).toHaveLength(2);
    expect(screen.getAllByText(t("acceptedAtLabel"))).toHaveLength(2);
  });

  it("reports the two consents independently when only one is accepted", async () => {
    // The pre-split account: use policy accepted, sharing consent still
    // outstanding. Collapsing these into one status would hide it.
    vi.mocked(consentService.getOrganizationStatus).mockResolvedValue({
      ...BOTH_ACCEPTED,
      dataSharing: { version: null, acceptedAt: null },
    });
    render(<OrganizationConsentCard />);

    expect(await screen.findByText(t("outstanding"))).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });

  it('distinguishes "not yet accepted" from a missing value', async () => {
    // An outstanding consent gets an explicit label, never a bare dash —
    // the two mean materially different things in an audit conversation.
    vi.mocked(consentService.getOrganizationStatus).mockResolvedValue({
      ...BOTH_ACCEPTED,
      usePolicy: { version: null, acceptedAt: null },
    });
    render(<OrganizationConsentCard />);

    const outstanding = await screen.findByText(t("outstanding"));
    expect(outstanding).toBeInTheDocument();
    expect(outstanding.textContent).not.toBe("—");
  });

  it("attributes the acceptance to the account owner", async () => {
    vi.mocked(consentService.getOrganizationStatus).mockResolvedValue(BOTH_ACCEPTED);
    render(<OrganizationConsentCard />);

    expect(await screen.findByText(t("acceptedByLabel"))).toBeInTheDocument();
    expect(screen.getByText(/Org Admin/)).toBeInTheDocument();
    expect(screen.getByText(/admin@demo-ngo\.org/)).toBeInTheDocument();
  });

  it("shows the empty state only when neither consent has been accepted", async () => {
    vi.mocked(consentService.getOrganizationStatus).mockResolvedValue({
      usePolicy: { version: null, acceptedAt: null },
      dataSharing: { version: null, acceptedAt: null },
      acceptedByName: null,
      acceptedByEmail: null,
    });
    render(<OrganizationConsentCard />);

    expect(await screen.findByText(t("noneYet"))).toBeInTheDocument();
    expect(screen.queryByText(t("versionLabel"))).not.toBeInTheDocument();
  });

  it("renders a placeholder while loading rather than an empty-state lie", async () => {
    // Showing "nobody has accepted" before the request resolves would be
    // wrong for the majority of orgs.
    vi.mocked(consentService.getOrganizationStatus).mockReturnValue(
      new Promise(() => {}) as never,
    );
    render(<OrganizationConsentCard />);

    expect(screen.queryByText(t("noneYet"))).not.toBeInTheDocument();
    expect(await screen.findByText(t("title"))).toBeInTheDocument();
  });

  it("keeps the card on screen when the status request fails", async () => {
    vi.mocked(consentService.getOrganizationStatus).mockRejectedValue(
      new Error("offline"),
    );
    render(<OrganizationConsentCard />);

    expect(await screen.findByText(t("title"))).toBeInTheDocument();
    await waitFor(() =>
      expect(consentService.getOrganizationStatus).toHaveBeenCalledOnce(),
    );
    expect(screen.queryByText(t("noneYet"))).not.toBeInTheDocument();
  });
});
