"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "@/i18n/navigation";

/**
 * Gate for the cross-entity Organizations screen — Center Supervisor's
 * read-only, platform-wide view. `PermissionGuard` alone can't express this:
 * `entityTeam` read is also true for an NGO Admin managing their own org, so
 * this additionally requires the role to be cross-entity in scope.
 */
export function CrossEntityGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const canReadEntityTeam = usePermission("entityTeam", "read");
  const router = useRouter();
  const allowed = Boolean(session?.role.crossEntity) && canReadEntityTeam;

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
