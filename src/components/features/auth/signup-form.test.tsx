import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import { SignupForm } from "@/components/features/auth/signup-form";
import { authService } from "@/services/auth/auth.service";
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

/** Radix Select/Popover need these in jsdom — it isn't a real pointer/layout environment. */
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(authService.signup).mockReset();
  vi.mocked(geographyService.listRegions).mockResolvedValue([REGION]);
  vi.mocked(geographyService.listGovernorates).mockResolvedValue([GOVERNORATE]);
  vi.mocked(geographyService.listCenters).mockResolvedValue([CENTER]);
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
      status: "pending_approval",
      organizationName: "Sunrise Village Fund",
      email: "a@b.org",
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
