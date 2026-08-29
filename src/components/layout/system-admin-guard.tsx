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
 * Three carve-outs, all opened for every crossEntity role, not just System
 * Admin, so the finer-grained check inside each page (CrossEntityGuard /
 * PermissionGuard) is what actually decides access — this outer gate just
 * stops it being redirected to /dashboard before that inner check runs:
 * - /system-admin/ncnp-report is now just a redirect stub (the NCNP
 *   Compiled Report merged into /reports) — kept open so a stale bookmark/
 *   link lands on the redirect instead of bouncing straight to /dashboard.
 * - /system-admin/organizations (list + detail) — RIO-RBAC-002 governance
 *   email (client-confirmed): System Reviewer holds View (platform-wide) +
 *   Approve on Users & Organizations, specifically to sign off on new
 *   organisation/tenant registrations. The page itself is already wrapped
 *   in CrossEntityGuard (crossEntity + entityTeam:read), and Create/Edit/
 *   Deactivate/Reactivate actions stay gated to entityTeam:write/:create,
 *   which only System Admin holds — so this carve-out only ever surfaces
 *   the view + the Approve action to System Reviewer, nothing more.
 * - /system-admin/audit-log — role-matrix.ts already grants System Reviewer
 *   `archiveSharingAudit: read` (client-confirmed: "Audit Log — View only"),
 *   but this outer gate was bouncing them to /dashboard before that grant
 *   ever got checked, making the platform-wide Audit Log fully unreachable
 *   for a role the backend already allows to view it. System Logs is
 *   deliberately NOT carved out here — that module stays System-Admin-only
 *   by design (see PERMISSION_MODULES' `systemLogs` comment in role-matrix.ts).
 */
export function SystemAdminGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isSystemAdmin = session?.role.key === "system_admin";
  const isSharedNcnpReportRoute = pathname.startsWith("/system-admin/ncnp-report");
  const isSharedOrganizationsRoute = pathname.startsWith("/system-admin/organizations");
  const isSharedAuditLogRoute = pathname.startsWith("/system-admin/audit-log");
  const allowed =
    isSystemAdmin ||
    ((isSharedNcnpReportRoute || isSharedOrganizationsRoute || isSharedAuditLogRoute) &&
      Boolean(session?.role.crossEntity));

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
