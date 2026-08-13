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
});
