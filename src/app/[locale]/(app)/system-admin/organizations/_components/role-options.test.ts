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
  it("keeps enabled organization roles and excludes disabled or cross-entity roles", () => {
    const result = getAssignableOrganizationRoles([
      role("ngo_admin"),
      role("research_lead"),
      role("disabled_role", false),
      role("system_admin", true, true),
      role("center_supervisor", true, true),
      role("citizen_guest"),
    ]);

    expect(result.map(({ key }) => key)).toEqual(["ngo_admin", "research_lead"]);
  });
});
