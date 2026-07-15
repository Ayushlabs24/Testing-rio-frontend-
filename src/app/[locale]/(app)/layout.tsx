import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { PasswordChangeGuard } from "@/components/layout/password-change-guard";

/**
 * `ConsentGuard` is intentionally out of this tree for now and will be added
 * back later. FR-2 requires policy acceptance at onboarding with the accepted
 * version and date stored, so this gate has to return before acceptance — it
 * is not dead code. `consent-guard.tsx` and the backend's /auth/consent route
 * are both untouched; restoring is re-wrapping <AppShell> in <ConsentGuard>.
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
