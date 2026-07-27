"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "@/i18n/navigation";

/**
 * Gate restricting all /system-admin/* routes strictly to System Admin users
 * (role.key === "system_admin"). Center Supervisors (crossEntity read-only) and
 * NGO Admins/Users are redirected away to /dashboard.
 */
export function SystemAdminGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const isSystemAdmin = session?.role.key === "system_admin";

  useEffect(() => {
    if (!isLoading && !isSystemAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, isSystemAdmin, router]);

  if (isLoading || !isSystemAdmin) {
    return null;
  }

  return <>{children}</>;
}
