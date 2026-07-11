"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "@/i18n/navigation";

/**
 * Gate for the one screen only System Admin should reach: creating and
 * viewing organizations across the whole platform. `PermissionGuard` alone
 * can't express this — write access on `entityTeam` is also true for an
 * NGO Admin managing their own org, so this additionally requires the
 * role to be cross-entity (System Admin, not NGO Admin).
 */
export function SystemAdminGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const canManageEntityTeam = usePermission("entityTeam", "write");
  const router = useRouter();
  const allowed = Boolean(session?.role.crossEntity) && canManageEntityTeam;

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
