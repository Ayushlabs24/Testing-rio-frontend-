import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ConsentGuard } from "@/components/layout/consent-guard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ConsentGuard>
        <AppShell>{children}</AppShell>
      </ConsentGuard>
    </AuthGuard>
  );
}
