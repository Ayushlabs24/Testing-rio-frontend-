import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PasswordChangeGuard } from "@/components/layout/password-change-guard";

/**
 * RIO-DATA-001 — consent is collected during registration only.
 *
 * `ConsentGuard` used to sit between PasswordChangeGuard and AppShell and
 * blocked the NGO Admin at login until both consents matched the active
 * policy versions. It has been removed: registration now captures both
 * consents in the same transaction that creates the organisation, so asking
 * again at sign-in re-asks for something already on record.
 *
 * Consequence, deliberately accepted: there is no longer any mechanism to
 * re-collect consent when a policy is superseded. Publishing a v2 policy
 * changes the text new registrants see, but existing users stay on the
 * version they accepted at registration and are never re-prompted.
 *
 * The other gap this leaves is an NGO Admin created through the System Admin
 * "create organization" flow rather than by self-registration — that path
 * never stamps consent, so those accounts now have no consent record at all.
 * If that matters, the fix belongs in the creation path, not in a login gate.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <PasswordChangeGuard>
        <AppShell>{children}</AppShell>
      </PasswordChangeGuard>
    </AuthGuard>
  );
}
