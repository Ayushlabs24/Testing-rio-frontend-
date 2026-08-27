import { describe, expect, it } from "vitest";
import { getAssignableOrganizationRoles } from "./role-options";

const role = (key: string, enabled = true, crossEntity = false) => ({
  id: key,
  key,
  name: key,
  enabled,
  crossEntity,
});

describe("getAssignableOrganizationRoles", () => {
  it("keeps enabled roles, including cross-entity Center Supervisor, but excludes the genuinely external/non-account roles", () => {
    const result = getAssignableOrganizationRoles([
      role("ngo_admin"),
      role("research_lead"),
      role("disabled_role", false),
      role("system_admin", true, true),
      role("system_reviewer", true, true),
      // Cross-entity in permissions, but still a real entity-account role —
      // System Admin (the only caller allowed here) can assign it, unlike a
      // tenant's own self-service invite.
      role("center_supervisor", true, true),
      role("citizen_guest"),
    ]);

    expect(result.map(({ key }) => key)).toEqual([
      "ngo_admin",
      "research_lead",
      "center_supervisor",
    ]);
  });

  // Regression: the Invite User and Change Role dialogs originally fetched
  // `GET /roles` raw via apiClient, typed as a local interface that *claimed*
  // an `enabled: boolean`. The backend's RoleDef (rbac/role-matrix.ts) carries
  // no such field — it is UI-only, synthesized by rolesService.list() from the
  // local matrix. So every role arrived `enabled: undefined`, this filter
  // dropped all of them, and both dropdowns rendered empty — leaving no way to
  // assign Center Supervisor anywhere in the UI. The `.catch(() => setRoles([]))`
  // in both dialogs made the failure indistinguishable from a normal empty list.
  //
  // This locks in the contract that made that a silent failure rather than a
  // type error: callers MUST go through rolesService, never a raw apiClient.get.
  it("drops every role when handed the raw backend shape, which has no `enabled` field", () => {
    const rawBackendRole = (key: string, crossEntity = false) => ({
      id: key,
      key,
      name: key,
      crossEntity,
    });

    const result = getAssignableOrganizationRoles([
      rawBackendRole("ngo_admin"),
      rawBackendRole("research_lead"),
      rawBackendRole("center_supervisor", true),
    ] as Parameters<typeof getAssignableOrganizationRoles>[0]);

    expect(result).toEqual([]);
  });
});
