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
  children,
}: PermissionGuardProps) {
  const { isLoading } = useAuth();
  const allowed = usePermission(module, action);
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
