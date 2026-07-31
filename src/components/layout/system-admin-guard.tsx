"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Gate restricting /system-admin/* routes strictly to System Admin users
 * (role.key === "system_admin"). Center Supervisors (crossEntity read-only) and
 * NGO Admins/Users are redirected away to /dashboard.
 *
 * One carve-out: /system-admin/ncnp-report is now just a redirect stub (the
 * NCNP Compiled Report merged into /reports) — still opened for every
 * crossEntity role, not just System Admin, so a stale bookmark/link lands
 * on the redirect instead of bouncing straight to /dashboard.
 */
export function SystemAdminGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isSystemAdmin = session?.role.key === "system_admin";
  const isSharedNcnpReportRoute = pathname.startsWith("/system-admin/ncnp-report");
  const allowed =
    isSystemAdmin || (isSharedNcnpReportRoute && Boolean(session?.role.crossEntity));

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.replace("/dashboard");
    }
  }, [isLoading, allowed, router]);

  if (isLoading || !allowed) {
    return null;
  }

  return <>{children}</>;
}
