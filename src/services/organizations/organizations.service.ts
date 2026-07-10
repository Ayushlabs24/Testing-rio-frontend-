import { findOrganizationById, findUserById } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import { diffChanges } from "@/services/audit/audit.diff";
import { auditService } from "@/services/audit/audit.service";
import type {
  Organization,
  UpdateOrganizationPayload,
} from "@/services/organizations/organizations.types";

/** Payload keys that carry an audited value → label shown in the audit trail. */
const ORGANIZATION_AUDIT_FIELDS: Record<string, string> = {
  name: "Name",
  region: "Region",
  email: "Email",
  sector: "Sector",
  villages: "Villages",
  isActive: "Active",
  logoUrl: "Logo",
};

function requireCurrentOrganizationId(): string {
  const session = mockSession.read();
  const user = session ? findUserById(session.userId) : undefined;
  if (!user) {
    throw new ApiError({ message: "Not authenticated.", status: 401 });
  }
  return user.organizationId;
}

export const organizationsService = {
  async getCurrent(): Promise<Organization> {
    await mockDelay();
    const organization = findOrganizationById(requireCurrentOrganizationId());
    if (!organization) {
      throw new ApiError({ message: "Organization not found.", status: 404 });
    }
    return organization;
  },

  async update(payload: UpdateOrganizationPayload): Promise<Organization> {
    await mockDelay();
    const organization = findOrganizationById(requireCurrentOrganizationId());
    if (!organization) {
      throw new ApiError({ message: "Organization not found.", status: 404 });
    }
    // Snapshot the audited fields before applying the payload so we can record
    // exact before/after values, not just which keys changed.
    const before = { ...organization };
    if (payload.name !== undefined) organization.name = payload.name;
    if (payload.logoUrl !== undefined) organization.logoUrl = payload.logoUrl;
    if (payload.region !== undefined) organization.region = payload.region;
    if (payload.email !== undefined) organization.email = payload.email;
    if (payload.sector !== undefined) organization.sector = payload.sector;
    if (payload.villages !== undefined) organization.villages = payload.villages;
    if (payload.isActive !== undefined) organization.isActive = payload.isActive;
    auditService.record({
      action: "edit",
      entityType: "organization",
      entityId: organization.id,
      entityLabel: organization.name,
      changes: diffChanges(
        before as unknown as Record<string, unknown>,
        organization as unknown as Record<string, unknown>,
        ORGANIZATION_AUDIT_FIELDS,
      ),
      metadata: { changed: Object.keys(payload) },
    });
    return organization;
  },
};
