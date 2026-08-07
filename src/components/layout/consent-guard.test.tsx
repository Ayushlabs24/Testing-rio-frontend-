import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { ConsentGuard } from "@/components/layout/consent-guard";
import { authService } from "@/services/auth/auth.service";
import { consentService } from "@/services/consent/consent.service";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * RIO-DATA-001 — the post-login re-prompt. Registration now captures both
 * consents up front, so this gate exists only for the two cases registration
 * cannot cover: accounts predating the data-sharing consent, and a version
 * bump on either policy. These tests pin that it re-prompts on exactly those
 * and lets everyone else straight through.
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

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => lookup(namespace, key),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/services/auth/auth.service", () => ({
  authService: { giveConsent: vi.fn() },
}));

vi.mock("@/services/consent/consent.service", () => ({
  consentService: { getActive: vi.fn() },
}));

const POLICIES = {
  usePolicy: { kind: "use_policy" as const, version: "v1", text: "Live use policy text" },
  dataSharing: {
    kind: "data_sharing" as const,
    version: "v1",
    text: "Live sharing consent text",
  },
};

const setSession = vi.fn();

function mockSession({
  roleKey = "ngo_admin",
  consentedPolicyVersion = null as string | null,
  sharingConsentedPolicyVersion = null as string | null,
} = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session: {
      user: {
        id: "u1",
        name: "Org Admin",
        consentedPolicyVersion,
        sharingConsentedPolicyVersion,
      },
      role: { key: roleKey },
    },
    setSession,
  } as never);
}

const CHILD = <p>Protected content</p>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consentService.getActive).mockResolvedValue(POLICIES);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsentGuard — who gets prompted", () => {
  it("prompts an NGO Admin who is current on neither consent", async () => {
    mockSession();
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText(lookup("app.consent", "title"))).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("lets an NGO Admin through once both accepted versions match the active ones", async () => {
    mockSession({ consentedPolicyVersion: "v1", sharingConsentedPolicyVersion: "v1" });
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("re-prompts on the sharing consent alone for a pre-split account", async () => {
    // Accepted the use policy at registration, but the data-sharing consent
    // did not exist yet — the whole reason the two versions are separate.
    mockSession({ consentedPolicyVersion: "v1", sharingConsentedPolicyVersion: null });
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText(lookup("app.consent", "title"))).toBeInTheDocument();
  });

  it.each([
    ["use policy", { consentedPolicyVersion: "v0", sharingConsentedPolicyVersion: "v1" }],
    [
      "data-sharing consent",
      { consentedPolicyVersion: "v1", sharingConsentedPolicyVersion: "v0" },
    ],
  ])("re-prompts after a version bump on the %s", async (_label, versions) => {
    // Checks the accepted version against the live one, not merely that a
    // timestamp exists — otherwise a policy bump would never re-prompt.
    mockSession(versions);
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText(lookup("app.consent", "title"))).toBeInTheDocument();
  });

  it("never prompts a non-admin member, and does not even fetch the policies", async () => {
    // The admin consents on behalf of the org; asking an invited Field
    // Researcher would be asking them to agree to something that is not
    // theirs to agree to.
    mockSession({ roleKey: "field_researcher" });
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(consentService.getActive).not.toHaveBeenCalled();
  });

  it("renders nothing while the active versions are still loading", () => {
    // Rather than flashing the consent screen at an already-consented admin.
    mockSession({ consentedPolicyVersion: "v1", sharingConsentedPolicyVersion: "v1" });
    vi.mocked(consentService.getActive).mockReturnValue(new Promise(() => {}) as never);

    const { container } = render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no session at all", () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, setSession } as never);

    const { container } = render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ConsentGuard — accepting", () => {
  it("shows each consent's live policy text, not the static fallback copy", async () => {
    mockSession();
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText("Live use policy text")).toBeInTheDocument();
    expect(screen.getByText("Live sharing consent text")).toBeInTheDocument();
  });

  it("still explains itself when the policies could not be loaded", async () => {
    mockSession();
    vi.mocked(consentService.getActive).mockRejectedValue(new Error("offline"));
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    expect(await screen.findByText(lookup("app.consent", "body"))).toBeInTheDocument();
    expect(screen.getByText(lookup("app.consent", "sharingBody"))).toBeInTheDocument();
  });

  it("refuses to submit until BOTH boxes are ticked", async () => {
    const user = userEvent.setup();
    mockSession();
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    await user.click(await screen.findByLabelText(lookup("app.consent", "agreeLabel")));
    await user.click(
      screen.getByRole("button", { name: new RegExp(lookup("app.consent", "accept")) }),
    );

    expect(
      await screen.findByText(lookup("app.consent", "mustAgree")),
    ).toBeInTheDocument();
    expect(authService.giveConsent).not.toHaveBeenCalled();
  });

  it("surfaces the validation error instead of silently disabling the button", async () => {
    const user = userEvent.setup();
    mockSession();
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    const button = await screen.findByRole("button", {
      name: new RegExp(lookup("app.consent", "accept")),
    });
    expect(button).toBeEnabled();
    await user.click(button);

    expect(
      await screen.findByText(lookup("app.consent", "mustAgree")),
    ).toBeInTheDocument();
  });

  it("accepts both consents in one call and installs the returned session", async () => {
    const user = userEvent.setup();
    const updated = {
      user: { consentedPolicyVersion: "v1", sharingConsentedPolicyVersion: "v1" },
    };
    vi.mocked(authService.giveConsent).mockResolvedValue(updated as never);
    mockSession();
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    await user.click(await screen.findByLabelText(lookup("app.consent", "agreeLabel")));
    await user.click(screen.getByLabelText(lookup("app.consent", "sharingAgreeLabel")));
    await user.click(
      screen.getByRole("button", { name: new RegExp(lookup("app.consent", "accept")) }),
    );

    await waitFor(() => expect(authService.giveConsent).toHaveBeenCalledOnce());
    expect(setSession).toHaveBeenCalledWith(updated);
  });

  it("surfaces a server failure and leaves the gate up", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.giveConsent).mockRejectedValue(new Error("Policy was updated"));
    mockSession();
    render(<ConsentGuard>{CHILD}</ConsentGuard>);

    await user.click(await screen.findByLabelText(lookup("app.consent", "agreeLabel")));
    await user.click(screen.getByLabelText(lookup("app.consent", "sharingAgreeLabel")));
    await user.click(
      screen.getByRole("button", { name: new RegExp(lookup("app.consent", "accept")) }),
    );

    expect(await screen.findByText("Policy was updated")).toBeInTheDocument();
    expect(setSession).not.toHaveBeenCalled();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
