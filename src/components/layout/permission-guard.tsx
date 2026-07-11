"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "@/i18n/navigation";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

interface PermissionGuardProps {
  module: PermissionModule;
  action?: PermissionAction;
  /**
   * Set for pages scoped to a single organization (e.g. Organization
   * profile, Users). A cross-entity role (System Admin, Center Supervisor)
   * can still hold read/write on the underlying module — entityTeam, for
   * instance — but these screens aren't theirs; System Admin has its own
   * cross-entity "Organizations" screen instead. Without this, direct URL
   * navigation would let them through even though the nav link is hidden.
   */
  entityOnly?: boolean;
  children: ReactNode;
}

/**
 * Route-level authorization check. `AuthGuard` only verifies "is someone
 * signed in" — this verifies "does this specific role have access to this
 * specific module." Redirects unauthorized roles away from the page itself,
 * not just hides the nav link to it (nav-hiding alone is not enforcement).
 */
export function PermissionGuard({
  module,
  action = "read",
  entityOnly = false,
  children,
}: PermissionGuardProps) {
  const { session, isLoading } = useAuth();
  const hasPermission = usePermission(module, action);
  const allowed = hasPermission && !(entityOnly && session?.role.crossEntity);
  const router = useRouter();

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
