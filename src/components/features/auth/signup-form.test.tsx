import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import { SignupForm } from "@/components/features/auth/signup-form";
import { authService } from "@/services/auth/auth.service";
import { consentService } from "@/services/consent/consent.service";
import { geographyService } from "@/services/geography/geography.service";

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

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => lookup(namespace, key),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

const SECTOR_OPTIONS = ["Health", "Education"];
vi.mock("@/hooks/use-sector-options", () => ({
  useSectorOptions: () => SECTOR_OPTIONS,
}));

vi.mock("@/services/auth/auth.service", () => ({
  authService: { signup: vi.fn() },
}));

const REGION = { id: "r1", code: 1, name: "Riyadh", isoCode: "SA-01", capital: "Riyadh" };
const GOVERNORATE = {
  id: "g1",
  code: "G1",
  regionId: "r1",
  name: "Riyadh Governorate",
  category: "urban",
};
const CENTER = {
  id: "c1",
  code: "C1",
  governorateId: "g1",
  name: "Central Center",
  category: "urban",
};

vi.mock("@/services/geography/geography.service", () => ({
  geographyService: {
    listRegions: vi.fn(),
    listGovernorates: vi.fn(),
    listCenters: vi.fn(),
  },
}));

// RIO-DATA-001 — the registration form fetches both active consent policies
// and submits the version of each. Distinct versions here so a bug that sent
// one version for both consents would be caught.
const USE_POLICY = {
  kind: "use_policy" as const,
  version: "v1",
  text: "Use policy text.",
};
const SHARING_POLICY = {
  kind: "data_sharing" as const,
  version: "v2",
  text: "Data-sharing consent text.",
};
vi.mock("@/services/consent/consent.service", () => ({
  consentService: { getActive: vi.fn() },
}));

/** Radix Select/Popover need these in jsdom — it isn't a real pointer/layout environment. */
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  // Radix's Checkbox measures itself via use-size; jsdom has no ResizeObserver.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.mocked(authService.signup).mockReset();
  vi.mocked(geographyService.listRegions).mockResolvedValue([REGION]);
  vi.mocked(geographyService.listGovernorates).mockResolvedValue([GOVERNORATE]);
  vi.mocked(geographyService.listCenters).mockResolvedValue([CENTER]);
  vi.mocked(consentService.getActive).mockResolvedValue({
    usePolicy: USE_POLICY,
    dataSharing: SHARING_POLICY,
  });
});

// Required-field <Label>s render "{label} *" (the asterisk marker is part of
// the label text), so their accessible name is never the bare translation
// string — match by substring instead of exact string everywhere a label
// query is used below.
function byLabel(text: string): RegExp {
  return new RegExp(text);
}

async function selectSector(name: string) {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("combobox", { name: byLabel(en.auth.signup.sectorLabel) }),
  );
  await user.click(await screen.findByRole("option", { name }));
  return user;
}

/** Region/Governorate/Center are required alongside the sector — fills all
 * three with the one seeded option so the sector-focused submit tests below
 * don't get blocked by unrelated geography validation errors. */
async function selectGeography(user: ReturnType<typeof userEvent.setup>) {
  const geo = en.app.settings.organization;
  await user.click(screen.getByRole("button", { name: geo.administrativeRegionLabel }));
  await user.click(await screen.findByRole("button", { name: REGION.name }));

  const governorateTrigger = screen.getByText(geo.governorateLabel).nextElementSibling;
  await user.click(governorateTrigger as Element);
  await user.click(await screen.findByText(GOVERNORATE.name));

  const centerTrigger = screen.getByText(geo.centerLabel).nextElementSibling;
  await user.click(centerTrigger as Element);
  await user.click(await screen.findByText(CENTER.name));
}

/**
 * Reads one policy end-to-end: opens its dialog from the link in the label,
 * scrolls the text to the bottom, and confirms. This is what unlocks that
 * consent's checkbox — the checkbox is disabled until it happens.
 *
 * jsdom has no layout, so scrollHeight/clientHeight are both 0 and the
 * component's own "not scrollable, therefore fully visible" branch treats the
 * text as read on open. That is the same branch a short policy takes in a
 * real browser, so the confirm button is reachable here without faking a
 * scroll event.
 */
async function readPolicy(user: ReturnType<typeof userEvent.setup>, linkLabel: string) {
  const link = await screen.findByRole("button", { name: linkLabel });
  await waitFor(() => expect(link).toBeEnabled());
  await user.click(link);

  const confirm = await screen.findByRole("button", {
    name: en.auth.signup.policyReadConfirm,
  });
  await waitFor(() => expect(confirm).toBeEnabled());
  await user.click(confirm);
}

/** RIO-DATA-001 — both consents are mandatory, and each must be read before
 * it can be ticked, so every test expecting a successful submit does both. */
async function acceptBothConsents(user: ReturnType<typeof userEvent.setup>) {
  await readPolicy(user, en.auth.signup.usePolicyLinkLabel);
  const usePolicy = screen.getByRole("checkbox", {
    name: byLabel(en.auth.signup.usePolicyLabel),
  });
  await waitFor(() => expect(usePolicy).toBeEnabled());
  await user.click(usePolicy);

  await readPolicy(user, en.auth.signup.dataSharingLinkLabel);
  const sharing = screen.getByRole("checkbox", {
    name: byLabel(en.auth.signup.dataSharingLabel),
  });
  await waitFor(() => expect(sharing).toBeEnabled());
  await user.click(sharing);
}

describe("SignupForm sector field", () => {
  it("lists every live domain plus a fixed Other option", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("combobox", { name: byLabel(en.auth.signup.sectorLabel) }),
    );

    for (const option of SECTOR_OPTIONS) {
      expect(await screen.findByRole("option", { name: option })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("option", { name: en.app.settings.organization.sectors.other }),
    ).toBeInTheDocument();
  });

  it("reveals the free-text field only when Other is selected", async () => {
    render(<SignupForm />);

    await selectSector(en.app.settings.organization.sectors.other);
    expect(screen.getByLabelText(en.auth.signup.otherSectorLabel)).toBeInTheDocument();

    await selectSector("Health");
    expect(
      screen.queryByLabelText(en.auth.signup.otherSectorLabel),
    ).not.toBeInTheDocument();
  });

  it("blocks submission with a validation error until a sector is chosen", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.organizationNameLabel)),
      "Sunrise Village Fund",
    );
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "REG-1",
    );
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(
      await screen.findByText(en.auth.validation.sectorRequired),
    ).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it("submits the selected sector with no purpose for a non-Other sector", async () => {
    vi.mocked(authService.signup).mockResolvedValue({
      session: {} as never,
      temporaryPasswordEmailed: true,
    });
    render(<SignupForm />);
    const user = await selectSector("Health");
    await selectGeography(user);

    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.organizationNameLabel)),
      "Sunrise Village Fund",
    );
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "REG-1",
    );
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    await acceptBothConsents(user);
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    await waitFor(() =>
      expect(authService.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: "Health",
          purpose: undefined,
          regionId: REGION.id,
          governorateIds: [GOVERNORATE.id],
          centerIds: [CENTER.id],
        }),
      ),
    );
  });

  it("submits the typed description as purpose when Other is selected", async () => {
    vi.mocked(authService.signup).mockResolvedValue({
      session: {} as never,
      temporaryPasswordEmailed: true,
    });
    render(<SignupForm />);
    const user = await selectSector(en.app.settings.organization.sectors.other);
    await selectGeography(user);

    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.organizationNameLabel)),
      "Sunrise Village Fund",
    );
    await user.type(
      screen.getByLabelText(en.auth.signup.otherSectorLabel),
      "Community Health",
    );
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "REG-1",
    );
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    await acceptBothConsents(user);
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    await waitFor(() =>
      expect(authService.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          sector: "other",
          purpose: "Community Health",
          regionId: REGION.id,
          governorateIds: [GOVERNORATE.id],
          centerIds: [CENTER.id],
        }),
      ),
    );
  });
});

/**
 * RIO-DATA-001 — consent moved into the registration flow itself, so that
 * registration cannot complete without it. These pin the two halves of that:
 * the form refuses to submit until both boxes are ticked, and what it sends
 * is the *version* of each policy shown, not a bare boolean.
 */
describe("SignupForm consent (RIO-DATA-001)", () => {
  /** Everything except the consent checkboxes. */
  async function fillEverythingElse() {
    const user = await selectSector("Health");
    await selectGeography(user);
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.organizationNameLabel)),
      "Sunrise Village Fund",
    );
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "REG-1",
    );
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    return user;
  }

  // The policy text lives in a dialog now, not inline on the form — it must
  // not be on the page until the reader opens it.
  it("keeps each policy's text behind its dialog until opened", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.auth.signup.usePolicyLinkLabel }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText(USE_POLICY.text)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: en.auth.signup.usePolicyLinkLabel }),
    );
    expect(await screen.findByText(USE_POLICY.text)).toBeInTheDocument();
  });

  // The core of this change: reading is a precondition for ticking.
  it("disables each checkbox until its own policy has been read", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();

    const usePolicyBox = await screen.findByRole("checkbox", {
      name: byLabel(en.auth.signup.usePolicyLabel),
    });
    const sharingBox = screen.getByRole("checkbox", {
      name: byLabel(en.auth.signup.dataSharingLabel),
    });
    expect(usePolicyBox).toBeDisabled();
    expect(sharingBox).toBeDisabled();

    await readPolicy(user, en.auth.signup.usePolicyLinkLabel);

    // Reading one policy unlocks only that one — the consents are independent.
    await waitFor(() => expect(usePolicyBox).toBeEnabled());
    expect(sharingBox).toBeDisabled();

    await readPolicy(user, en.auth.signup.dataSharingLinkLabel);
    await waitFor(() => expect(sharingBox).toBeEnabled());
  });

  // Reading unlocks the box; it must never tick it on the reader's behalf.
  it("leaves the checkbox unticked after reading, so accepting stays deliberate", async () => {
    render(<SignupForm />);
    const user = userEvent.setup();

    await readPolicy(user, en.auth.signup.usePolicyLinkLabel);

    const usePolicyBox = screen.getByRole("checkbox", {
      name: byLabel(en.auth.signup.usePolicyLabel),
    });
    await waitFor(() => expect(usePolicyBox).toBeEnabled());
    expect(usePolicyBox).not.toBeChecked();
  });

  it("blocks registration when neither consent is accepted", async () => {
    render(<SignupForm />);
    const user = await fillEverythingElse();

    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(
      await screen.findByText(en.auth.validation.usePolicyRequired),
    ).toBeInTheDocument();
    expect(screen.getByText(en.auth.validation.dataSharingRequired)).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it("blocks registration when only the use policy is accepted", async () => {
    render(<SignupForm />);
    const user = await fillEverythingElse();

    await readPolicy(user, en.auth.signup.usePolicyLinkLabel);
    const usePolicy = screen.getByRole("checkbox", {
      name: byLabel(en.auth.signup.usePolicyLabel),
    });
    await waitFor(() => expect(usePolicy).toBeEnabled());
    await user.click(usePolicy);
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(
      await screen.findByText(en.auth.validation.dataSharingRequired),
    ).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it("blocks registration when only the data-sharing consent is accepted", async () => {
    render(<SignupForm />);
    const user = await fillEverythingElse();

    await readPolicy(user, en.auth.signup.dataSharingLinkLabel);
    const sharing = screen.getByRole("checkbox", {
      name: byLabel(en.auth.signup.dataSharingLabel),
    });
    await waitFor(() => expect(sharing).toBeEnabled());
    await user.click(sharing);
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(
      await screen.findByText(en.auth.validation.usePolicyRequired),
    ).toBeInTheDocument();
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it("submits each policy's own version once both are accepted", async () => {
    vi.mocked(authService.signup).mockResolvedValue({
      session: {} as never,
      temporaryPasswordEmailed: true,
    });
    render(<SignupForm />);
    const user = await fillEverythingElse();
    await acceptBothConsents(user);

    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    await waitFor(() =>
      expect(authService.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          // Distinct versions — one value reused for both would fail here.
          consent: { usePolicyVersion: "v1", dataSharingVersion: "v2" },
        }),
      ),
    );
  });

  it("cannot register at all when the policies fail to load", async () => {
    vi.mocked(consentService.getActive).mockRejectedValue(new Error("offline"));
    render(<SignupForm />);
    await fillEverythingElse();

    // No version to pin the acceptance to, so submit is disabled outright
    // rather than left to fail at the server.
    expect(
      await screen.findByText(en.auth.signup.consentUnavailableError),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.auth.signup.submit })).toBeDisabled();
    expect(authService.signup).not.toHaveBeenCalled();
  });
});

/**
 * The scroll gate specifically. jsdom has no layout — scrollHeight and
 * clientHeight are both 0, so the component takes its "content fits, nothing
 * to scroll" branch and every other test in this file reaches the confirm
 * button immediately. These stub the two properties to simulate overflowing
 * text, which is the only way to exercise the branch that actually enforces
 * reading to the end.
 */
describe("SignupForm policy dialog scroll gate", () => {
  /** Makes every element report overflowing content, scrolled to the top. */
  function makeContentOverflow({ scrollTop }: { scrollTop: number }) {
    const el = HTMLElement.prototype;
    vi.spyOn(el, "scrollHeight", "get").mockReturnValue(1000);
    vi.spyOn(el, "clientHeight", "get").mockReturnValue(200);
    vi.spyOn(el, "scrollTop", "get").mockReturnValue(scrollTop);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the confirm button locked until the text is scrolled to the end", async () => {
    makeContentOverflow({ scrollTop: 0 });
    render(<SignupForm />);
    const user = userEvent.setup();

    const link = await screen.findByRole("button", {
      name: en.auth.signup.usePolicyLinkLabel,
    });
    await waitFor(() => expect(link).toBeEnabled());
    await user.click(link);

    const confirm = await screen.findByRole("button", {
      name: en.auth.signup.policyReadConfirm,
    });
    // Opened at the top of a long policy — not read yet.
    expect(confirm).toBeDisabled();
    expect(screen.getByText(en.auth.signup.scrollHint)).toBeInTheDocument();

    // Scroll to the bottom: 800 + 200 === 1000.
    vi.spyOn(HTMLElement.prototype, "scrollTop", "get").mockReturnValue(800);
    fireEvent.scroll(
      screen.getByRole("region", { name: en.auth.signup.usePolicyDialogTitle }),
    );

    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.queryByText(en.auth.signup.scrollHint)).not.toBeInTheDocument();
  });

  it("does not unlock the checkbox when the reader abandons a policy part-way", async () => {
    makeContentOverflow({ scrollTop: 0 });
    render(<SignupForm />);
    const user = userEvent.setup();

    const link = await screen.findByRole("button", {
      name: en.auth.signup.usePolicyLinkLabel,
    });
    await waitFor(() => expect(link).toBeEnabled());
    await user.click(link);

    // Part-way down (300 + 200 = 500, short of 1000), then close without
    // confirming — the equivalent of skimming and hitting Escape.
    vi.spyOn(HTMLElement.prototype, "scrollTop", "get").mockReturnValue(300);
    fireEvent.scroll(
      screen.getByRole("region", { name: en.auth.signup.usePolicyDialogTitle }),
    );
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: en.auth.signup.policyReadConfirm }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("checkbox", { name: byLabel(en.auth.signup.usePolicyLabel) }),
    ).toBeDisabled();
  });
});
