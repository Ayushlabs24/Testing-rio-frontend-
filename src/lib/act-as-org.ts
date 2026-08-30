import type { RequestOptions } from "@/services/api/types";

// RIO-RBAC-002 (client-confirmed, 2026-08-27 round) — System Admin is
// platform-wide, not tied to one organisation, so creating a Study/Need/
// User/etc. on behalf of a specific org requires explicitly choosing one.
// The backend's JwtAuthGuard reads this exact header, validates the caller
// is a crossEntity role and the target org is real/active, and swaps the
// request's org context to it — see that guard for the server-side half.
// A non-crossEntity caller sending this header is silently ignored there,
// so it's harmless to always attach when `orgId` is set, never required
// otherwise.
const ACT_AS_ORG_HEADER = "X-Act-As-Org";

/** Spread into an apiClient call's `options` when acting on behalf of a
 * chosen organisation (System Admin only) — returns `undefined` (no
 * header) when `orgId` is falsy, so call sites don't need their own
 * conditional. */
export function actAsOrgOptions(orgId?: string | null): RequestOptions | undefined {
  if (!orgId) return undefined;
  return { headers: { [ACT_AS_ORG_HEADER]: orgId } };
}
