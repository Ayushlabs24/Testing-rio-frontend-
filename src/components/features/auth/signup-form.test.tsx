import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import { SignupForm } from "@/components/features/auth/signup-form";
import { ApiError } from "@/services/api/types";
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

// Hoisted so `vi.mock`'s factory can close over it — the locale has to be
// settable per test, since which language the form renders the consents in is
// now part of what these tests cover.
const intl = vi.hoisted(() => ({ locale: "en" }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => lookup(namespace, key),
  useLocale: () => intl.locale,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

// A registration number of the shape the backend now demands: the entity's
// 10-digit unified national number, checked against the NIC entity registry.
const NIC_NUMBER = "7011038218";

const SECTOR_OPTIONS = [
  { name: "Health", nameAr: null },
  { name: "Education", nameAr: null },
];
vi.mock("@/hooks/use-sector-options", () => ({
  useSectorOptions: () => SECTOR_OPTIONS,
}));

vi.mock("@/services/auth/auth.service", () => ({
  authService: { signup: vi.fn(), verifyRegistrationNumber: vi.fn() },
}));

const REGION = {
  id: "r1",
  code: 1,
  name: "Riyadh",
  nameAr: null,
  isoCode: "SA-01",
  capital: "Riyadh",
};
const GOVERNORATE = {
  id: "g1",
  code: "G1",
  regionId: "r1",
  name: "Riyadh Governorate",
  nameAr: null,
  category: "urban",
};
const CENTER = {
  id: "c1",
  code: "C1",
  governorateId: "g1",
  name: "Central Center",
  nameAr: null,
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
// The use policy is translated and the data-sharing one is not, so the same
// pair covers both the Arabic rendering and the per-policy fall-back to
// English that a partially-translated set produces.
const USE_POLICY = {
  kind: "use_policy" as const,
  version: "v1",
  text: "Use policy text.",
  textAr: "نص سياسة الاستخدام.",
};
const SHARING_POLICY = {
  kind: "data_sharing" as const,
  version: "v2",
  text: "Data-sharing consent text.",
  textAr: null,
};
vi.mock("@/services/consent/consent.service", () => ({
  consentService: { getActive: vi.fn() },
}));

/** Radix Select/Popover need these in jsdom — it isn't a real pointer/layout environment. */
beforeEach(() => {
  // Reset per test — an Arabic case must not leak into the next one.
  intl.locale = "en";
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
  vi.mocked(authService.verifyRegistrationNumber).mockReset();
  vi.mocked(authService.verifyRegistrationNumber).mockResolvedValue({ verified: true });
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

/**
 * `delay: null` disables user-event's inter-keystroke pause.
 *
 * Not a micro-optimisation: the NIC gate means every test here first types a
 * 10-digit registration number and waits for Verify, on top of an org name
 * and an email — hundreds of keystrokes per file, each otherwise yielding to
 * the event loop. That pushed the slowest cases past vitest's 5s limit
 * whenever the suite ran alongside other files competing for CPU, so the file
 * failed intermittently on nothing but timing. The pause buys no realism in
 * jsdom, where there is no debounce or async validation keyed off typing
 * speed for it to exercise.
 */
const setupUser = () => userEvent.setup({ delay: null });

/**
 * Takes the `user` rather than creating one: every field below the
 * registration number is locked until that number is verified, so the sector
 * can only be picked after `verifyRegistrationNumber` has run.
 */
async function selectSector(user: ReturnType<typeof userEvent.setup>, name: string) {
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

/**
 * Types a registration number and clicks Verify. Submit is now gated on a
 * confirmed number, so every test that reaches "Create organization" has to
 * go through this — the same step a real registrant takes.
 */
async function unlockForm(
  user: ReturnType<typeof userEvent.setup>,
  {
    organizationName = "Sunrise Village Fund",
    registrationNumber = NIC_NUMBER,
  }: { organizationName?: string; registrationNumber?: string } = {},
) {
  await user.type(
    screen.getByLabelText(byLabel(en.auth.signup.organizationNameLabel)),
    organizationName,
  );
  await verifyRegistrationNumber(user, registrationNumber);
  return user;
}

async function verifyRegistrationNumber(
  user: ReturnType<typeof userEvent.setup>,
  value: string,
) {
  await user.type(
    screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
    value,
  );
  await user.click(
    screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
  );
  await screen.findByText(en.auth.signup.registrationNumberVerified);
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
    const user = await unlockForm(setupUser());
    await user.click(
      screen.getByRole("combobox", { name: byLabel(en.auth.signup.sectorLabel) }),
    );

    for (const option of SECTOR_OPTIONS) {
      expect(
        await screen.findByRole("option", { name: option.name }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("option", { name: en.app.settings.organization.sectors.other }),
    ).toBeInTheDocument();
  });

  it("reveals the free-text field only when Other is selected", async () => {
    render(<SignupForm />);
    const user = await unlockForm(setupUser());

    await selectSector(user, en.app.settings.organization.sectors.other);
    expect(screen.getByLabelText(en.auth.signup.otherSectorLabel)).toBeInTheDocument();

    await selectSector(user, "Health");
    expect(
      screen.queryByLabelText(en.auth.signup.otherSectorLabel),
    ).not.toBeInTheDocument();
  });

  it("keeps registration blocked until a sector is chosen", async () => {
    render(<SignupForm />);
    const user = await unlockForm(setupUser());

    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    await selectGeography(user);
    await acceptBothConsents(user);

    // Complete but for the sector: the submit button is inert, and clicking
    // it cannot reach the API.
    const submit = screen.getByRole("button", { name: en.auth.signup.submit });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(authService.signup).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("combobox", { name: byLabel(en.auth.signup.sectorLabel) }),
    );
    await user.click(await screen.findByRole("option", { name: "Health" }));

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("submits the selected sector with no purpose for a non-Other sector", async () => {
    vi.mocked(authService.signup).mockResolvedValue({
      status: "pending_approval",
      organizationName: "Sunrise Village Fund",
      email: "a@b.org",
    });
    render(<SignupForm />);
    const user = await unlockForm(setupUser());
    await selectSector(user, "Health");
    await selectGeography(user);
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
      status: "pending_approval",
      organizationName: "Sunrise Village Fund",
      email: "a@b.org",
    });
    render(<SignupForm />);
    const user = await unlockForm(setupUser());
    await selectSector(user, en.app.settings.organization.sectors.other);
    await selectGeography(user);
    await user.type(
      screen.getByLabelText(en.auth.signup.otherSectorLabel),
      "Community Health",
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
 * The registration number must be the entity's NIC number. The server is the
 * gate — it checks the number against the published entity registry — so what
 * matters here is that a rejection is legible: localized, and attached to the
 * field that caused it rather than buried in the form-wide banner.
 */
describe("SignupForm registration number (NIC registry)", () => {
  /** Every required field answered, ending with a verified number. */
  async function fillEverything(registrationNumber: string) {
    const user = await unlockForm(setupUser(), { registrationNumber });
    await selectSector(user, "Health");
    await selectGeography(user);
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    await acceptBothConsents(user);
    return user;
  }

  it("locks every field below the registration number until it is verified", async () => {
    render(<SignupForm />);
    const user = setupUser();

    // Only the two fields a registrant can meaningfully answer up front.
    expect(
      screen.getByLabelText(byLabel(en.auth.signup.organizationNameLabel)),
    ).toBeEnabled();
    expect(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
    ).toBeEnabled();
    expect(
      screen.getByRole("combobox", { name: byLabel(en.auth.signup.sectorLabel) }),
    ).toBeDisabled();
    expect(screen.getByLabelText(byLabel(en.auth.signup.emailLabel))).toBeDisabled();
    expect(screen.getByText(en.auth.signup.verifyToUnlockHint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.auth.signup.submit })).toBeDisabled();

    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      NIC_NUMBER,
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
    );

    await waitFor(() =>
      expect(screen.getByLabelText(byLabel(en.auth.signup.emailLabel))).toBeEnabled(),
    );
    expect(
      screen.getByRole("combobox", { name: byLabel(en.auth.signup.sectorLabel) }),
    ).toBeEnabled();
    expect(screen.queryByText(en.auth.signup.verifyToUnlockHint)).not.toBeInTheDocument();
  });

  it("re-locks the rest of the form when a verified number is edited", async () => {
    render(<SignupForm />);
    const user = await unlockForm(setupUser());
    expect(screen.getByLabelText(byLabel(en.auth.signup.emailLabel))).toBeEnabled();

    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "9",
    );

    await waitFor(() =>
      expect(screen.getByLabelText(byLabel(en.auth.signup.emailLabel))).toBeDisabled(),
    );
  });

  it("keeps registration blocked until the number has been verified", async () => {
    render(<SignupForm />);
    const user = await unlockForm(setupUser());
    await selectSector(user, "Health");
    await selectGeography(user);
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    await acceptBothConsents(user);

    const submit = screen.getByRole("button", { name: en.auth.signup.submit });
    await waitFor(() => expect(submit).toBeEnabled());

    // Editing the number withdraws the verification, and with it the button.
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "9",
    );

    await waitFor(() => expect(submit).toBeDisabled());
  });

  it("accepts a number typed with separators — the server normalizes it", async () => {
    vi.mocked(authService.signup).mockResolvedValue({
      status: "pending_approval",
      organizationName: "Sunrise Village Fund",
      email: "a@b.org",
    });
    render(<SignupForm />);
    const user = await fillEverything("7011-038-218");
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    await waitFor(() => expect(authService.signup).toHaveBeenCalled());
    expect(
      screen.queryByText(en.auth.validation.registrationNumberFormat),
    ).not.toBeInTheDocument();
  });

  it("shows the localized 'not in the registry' message on the field, not the server's English text", async () => {
    vi.mocked(authService.signup).mockRejectedValue(
      new ApiError({
        message:
          "This registration number was not found in the national entity registry.",
        status: 400,
        code: "REGISTRATION_NUMBER_NOT_RECOGNISED",
      }),
    );
    render(<SignupForm />);
    const user = await fillEverything("9999999999");
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(
      await screen.findByText(en.auth.validation.registrationNumberUnknown),
    ).toBeInTheDocument();
    // The registrant stays on the form, and nothing claims success.
    expect(
      screen.queryByText(en.auth.signup.pendingApprovalTitle),
    ).not.toBeInTheDocument();
  });

  it("confirms a registered number in place when Verify is clicked", async () => {
    render(<SignupForm />);
    const user = setupUser();
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      NIC_NUMBER,
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
    );

    expect(
      await screen.findByText(en.auth.signup.registrationNumberVerified),
    ).toBeInTheDocument();
    expect(authService.verifyRegistrationNumber).toHaveBeenCalledWith(NIC_NUMBER);
    // Verifying is not registering.
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it("reports an unregistered number on the field instead of confirming it", async () => {
    vi.mocked(authService.verifyRegistrationNumber).mockResolvedValue({
      verified: false,
      reason: "NOT_FOUND",
    });
    render(<SignupForm />);
    const user = setupUser();
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "9999999999",
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
    );

    expect(
      await screen.findByText(en.auth.validation.registrationNumberUnknown),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(en.auth.signup.registrationNumberVerified),
    ).not.toBeInTheDocument();
  });

  it("drops the confirmation once the number is edited", async () => {
    // A tick left standing next to a number nobody checked would be a lie.
    render(<SignupForm />);
    const user = setupUser();
    const field = screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel));
    await user.type(field, NIC_NUMBER);
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
    );
    expect(
      await screen.findByText(en.auth.signup.registrationNumberVerified),
    ).toBeInTheDocument();

    await user.type(field, "9");

    await waitFor(() =>
      expect(
        screen.queryByText(en.auth.signup.registrationNumberVerified),
      ).not.toBeInTheDocument(),
    );
  });

  it("disables the Verify button when the registration number field is empty", async () => {
    render(<SignupForm />);

    const verifyButton = screen.getByRole("button", {
      name: en.auth.signup.verifyRegistrationNumber,
    });
    // Field is empty on mount — the button must be inert so clicking it
    // can't fire a request that would only say "wrong shape" anyway.
    expect(verifyButton).toBeDisabled();

    // Typing anything enables it.
    const user = setupUser();
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      NIC_NUMBER,
    );
    expect(verifyButton).toBeEnabled();

    // Clearing the field disables it again.
    await user.clear(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
    );
    expect(verifyButton).toBeDisabled();
    expect(authService.verifyRegistrationNumber).not.toHaveBeenCalled();
  });

  it("does not spend a verification request on a number of the wrong shape", async () => {
    render(<SignupForm />);
    const user = setupUser();
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      "NGO123",
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
    );

    expect(
      await screen.findByText(en.auth.validation.registrationNumberFormat),
    ).toBeInTheDocument();
    expect(authService.verifyRegistrationNumber).not.toHaveBeenCalled();
  });

  it("says verification is unavailable — not that the number is wrong — when the check itself fails", async () => {
    vi.mocked(authService.verifyRegistrationNumber).mockRejectedValue(
      new ApiError({ message: "Too many requests", status: 429 }),
    );
    render(<SignupForm />);
    const user = setupUser();
    await user.type(
      screen.getByLabelText(byLabel(en.auth.signup.registrationNumberLabel)),
      NIC_NUMBER,
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.verifyRegistrationNumber }),
    );

    expect(
      await screen.findByText(en.auth.validation.registrationNumberVerifyFailed),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(en.auth.validation.registrationNumberUnknown),
    ).not.toBeInTheDocument();
  });

  it("falls back to the form-wide banner, translated, for errors that aren't about this field", async () => {
    // A code the client-error dictionary doesn't recognise: must render the
    // translated generic fallback, never the backend's raw English message
    // (client-reported gap, 2026-09-09 — an untranslated backend message was
    // reaching the Arabic UI verbatim).
    vi.mocked(authService.signup).mockRejectedValue(
      new ApiError({ message: "Server exploded", status: 500, code: "INTERNAL_ERROR" }),
    );
    render(<SignupForm />);
    const user = await fillEverything(NIC_NUMBER);
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(await screen.findByText(en.auth.signup.genericError)).toBeInTheDocument();
    expect(screen.queryByText("Server exploded")).not.toBeInTheDocument();
  });

  it("translates a recognised API error code instead of showing the backend's raw message", async () => {
    vi.mocked(authService.signup).mockRejectedValue(
      new ApiError({
        message: "An account with this email already exists.",
        status: 409,
        code: "EMAIL_ALREADY_REGISTERED",
      }),
    );
    render(<SignupForm />);
    const user = await fillEverything(NIC_NUMBER);
    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    expect(
      await screen.findByText(en.auth.apiErrors.EMAIL_ALREADY_REGISTERED),
    ).toBeInTheDocument();
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
    const user = await unlockForm(setupUser());
    await selectSector(user, "Health");
    await selectGeography(user);
    await user.type(screen.getByLabelText(byLabel(en.auth.signup.emailLabel)), "a@b.org");
    return user;
  }

  // The policy text lives in a dialog now, not inline on the form — it must
  // not be on the page until the reader opens it.
  it("keeps each policy's text behind its dialog until opened", async () => {
    render(<SignupForm />);
    // The consents sit inside the block that stays locked until the
    // registration number is verified, so every test here unlocks first.
    const user = await unlockForm(setupUser());

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

  // RIO-NFR-007 — the consent an Arabic registrant is asked to accept has to
  // BE in Arabic. The dialog title was already translated in the UI bundle;
  // the body comes from the policy table, so it needs the locale to reach the
  // server payload and the text-picking helper alike.
  it("renders the Arabic policy body when the page locale is Arabic", async () => {
    intl.locale = "ar";
    render(<SignupForm />);
    const user = await unlockForm(setupUser());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.auth.signup.usePolicyLinkLabel }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.usePolicyLinkLabel }),
    );

    expect(await screen.findByText(USE_POLICY.textAr)).toBeInTheDocument();
    // Not merely "Arabic is also present" — the English source must be gone,
    // which is the bug a naive `text ?? textAr` fallback would leave behind.
    expect(screen.queryByText(USE_POLICY.text)).not.toBeInTheDocument();
  });

  // A policy whose translation is still outstanding must not render blank:
  // an untranslated consent is a content gap, an empty one is a broken
  // registration. SHARING_POLICY has textAr: null for exactly this case.
  it("falls back to the English body for a policy with no Arabic copy", async () => {
    intl.locale = "ar";
    render(<SignupForm />);
    const user = await unlockForm(setupUser());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: en.auth.signup.dataSharingLinkLabel }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: en.auth.signup.dataSharingLinkLabel }),
    );

    expect(await screen.findByText(SHARING_POLICY.text)).toBeInTheDocument();
  });

  // The locale is submitted alongside the versions — without it the server
  // would snapshot the English wording onto an Arabic reader's acceptance.
  it("submits the locale the consents were displayed in", async () => {
    intl.locale = "ar";
    vi.mocked(authService.signup).mockResolvedValue({
      status: "pending_approval",
      organizationName: "Demo NGO",
      email: "a@b.org",
    });
    render(<SignupForm />);
    const user = await fillEverythingElse();
    await acceptBothConsents(user);

    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    await waitFor(() =>
      expect(authService.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          consent: expect.objectContaining({ locale: "ar" }),
        }),
      ),
    );
  });

  // The core of this change: reading is a precondition for ticking.
  it("disables each checkbox until its own policy has been read", async () => {
    render(<SignupForm />);
    const user = await unlockForm(setupUser());

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
    const user = await unlockForm(setupUser());

    await readPolicy(user, en.auth.signup.usePolicyLinkLabel);

    const usePolicyBox = screen.getByRole("checkbox", {
      name: byLabel(en.auth.signup.usePolicyLabel),
    });
    await waitFor(() => expect(usePolicyBox).toBeEnabled());
    expect(usePolicyBox).not.toBeChecked();
  });

  // Submit is gated on a complete form now, so an unticked consent leaves the
  // button disabled rather than producing a per-checkbox error on click. The
  // guarantee these pin is unchanged — no registration without both consents —
  // it's just enforced a step earlier.
  it("blocks registration when neither consent is accepted", async () => {
    render(<SignupForm />);
    const user = await fillEverythingElse();

    const submit = screen.getByRole("button", { name: en.auth.signup.submit });
    expect(submit).toBeDisabled();
    await user.click(submit);
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

    const submit = screen.getByRole("button", { name: en.auth.signup.submit });
    expect(submit).toBeDisabled();
    await user.click(submit);
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

    const submit = screen.getByRole("button", { name: en.auth.signup.submit });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(authService.signup).not.toHaveBeenCalled();
  });

  it("enables registration only once both consents are ticked", async () => {
    render(<SignupForm />);
    const user = await fillEverythingElse();
    const submit = screen.getByRole("button", { name: en.auth.signup.submit });
    expect(submit).toBeDisabled();

    await acceptBothConsents(user);

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("submits each policy's own version once both are accepted", async () => {
    vi.mocked(authService.signup).mockResolvedValue({
      status: "pending_approval",
      organizationName: "Demo NGO",
      email: "priya@demo.org",
    });
    render(<SignupForm />);
    const user = await fillEverythingElse();
    await acceptBothConsents(user);

    await user.click(screen.getByRole("button", { name: en.auth.signup.submit }));

    await waitFor(() =>
      expect(authService.signup).toHaveBeenCalledWith(
        expect.objectContaining({
          // Distinct versions — one value reused for both would fail here.
          // The locale rides along so the server can snapshot the wording
          // that was actually displayed.
          consent: { usePolicyVersion: "v1", dataSharingVersion: "v2", locale: "en" },
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
    // The consent block is locked until the registration number is verified.
    const user = await unlockForm(setupUser());

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
    // The consent block is locked until the registration number is verified.
    const user = await unlockForm(setupUser());

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
