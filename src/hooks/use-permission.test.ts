import { describe, expect, it, vi } from "vitest";
import type { SessionContext } from "@/services/auth/auth.types";
import type { ModulePermission } from "@/types/permissions";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: useAuthMock }));

// Imported after the mock is registered so the hook binds to it.
const { usePermission } = await import("@/hooks/use-permission");

function perm(
  module: ModulePermission["module"],
  grant: Partial<ModulePermission>,
): ModulePermission {
  return {
    module,
    read: false,
    write: false,
    create: false,
    approve: false,
    export: false,
    share: false,
    ...grant,
  };
}

/** Only the fields usePermission reads — not a full SessionContext. */
function session(role: {
  enabled: boolean;
  permissions: ModulePermission[];
}): SessionContext {
  return { role } as unknown as SessionContext;
}

function signedInAs(permissions: ModulePermission[], enabled = true): void {
  useAuthMock.mockReturnValue({ session: session({ enabled, permissions }) });
}

describe("usePermission", () => {
  it("resolves each action against its own grant, not read", () => {
    // The shape the role matrix gives an NGO Research Officer on studySurvey:
    // read/write/create/export granted, approve/share withheld.
    signedInAs([
      perm("studySurvey", { read: true, write: true, create: true, export: true }),
    ]);

    expect(usePermission("studySurvey", "read")).toBe(true);
    expect(usePermission("studySurvey", "write")).toBe(true);
    expect(usePermission("studySurvey", "create")).toBe(true);
    expect(usePermission("studySurvey", "export")).toBe(true);
    expect(usePermission("studySurvey", "approve")).toBe(false);
    expect(usePermission("studySurvey", "share")).toBe(false);
  });

  it("does not grant create/approve/export/share off the back of read", () => {
    // Regression: the read-only shape every viewer role gets. The previous
    // implementation branched only on "write" and fell through to `read` for
    // everything else, so all four of these answered true — a Read-only
    // Viewer would have been shown "New study" and "Approve".
    signedInAs([perm("studySurvey", { read: true })]);

    expect(usePermission("studySurvey", "read")).toBe(true);
    expect(usePermission("studySurvey", "create")).toBe(false);
    expect(usePermission("studySurvey", "approve")).toBe(false);
    expect(usePermission("studySurvey", "export")).toBe(false);
    expect(usePermission("studySurvey", "share")).toBe(false);
    expect(usePermission("studySurvey", "write")).toBe(false);
  });

  it("defaults to the read grant when no action is passed", () => {
    signedInAs([perm("studySurvey", { read: true })]);
    expect(usePermission("studySurvey")).toBe(true);

    signedInAs([perm("studySurvey", { write: true })]);
    expect(usePermission("studySurvey")).toBe(false);
  });

  it("denies every action for a disabled role", () => {
    signedInAs(
      [
        perm("studySurvey", {
          read: true,
          write: true,
          create: true,
          approve: true,
          export: true,
          share: true,
        }),
      ],
      false,
    );

    expect(usePermission("studySurvey", "read")).toBe(false);
    expect(usePermission("studySurvey", "write")).toBe(false);
    expect(usePermission("studySurvey", "create")).toBe(false);
    expect(usePermission("studySurvey", "approve")).toBe(false);
    expect(usePermission("studySurvey", "export")).toBe(false);
    expect(usePermission("studySurvey", "share")).toBe(false);
  });

  it("denies when signed out or when the module has no entry", () => {
    useAuthMock.mockReturnValue({ session: null });
    expect(usePermission("studySurvey", "read")).toBe(false);

    signedInAs([perm("entityTeam", { read: true, create: true })]);
    expect(usePermission("studySurvey", "read")).toBe(false);
    expect(usePermission("studySurvey", "create")).toBe(false);
  });
});
