import { organizations } from "@/mocks/data/organizations";
import { roles } from "@/mocks/data/roles";
import { users } from "@/mocks/data/users";
import { findOrganizationById, findUserByEmail, findUserById } from "@/mocks/db";
import { mockSession } from "@/mocks/session";
import { generateId, mockDelay } from "@/mocks/utils";
import { ApiError } from "@/services/api/types";
import type {
  CreateOrganizationPayload,
  Organization,
  OrganizationSummary,
  UpdateOrganizationPayload,
} from "@/services/organizations/organizations.types";

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
    if (payload.name !== undefined) organization.name = payload.name;
    if (payload.logoUrl !== undefined) organization.logoUrl = payload.logoUrl;
    if (payload.region !== undefined) organization.region = payload.region;
    if (payload.email !== undefined) organization.email = payload.email;
    if (payload.sector !== undefined) organization.sector = payload.sector;
    if (payload.villages !== undefined) organization.villages = payload.villages;
    if (payload.isActive !== undefined) organization.isActive = payload.isActive;
    return organization;
  },

  /** Cross-entity — System Admin only. Every org, regardless of the caller's own. */
  async listAll(): Promise<OrganizationSummary[]> {
    await mockDelay();
    return organizations.map((organization) => ({
      ...organization,
      memberCount: users.filter((user) => user.organizationId === organization.id).length,
    }));
  },

  /** Cross-entity — System Admin viewing any organization's details, not just their own. */
  async getById(id: string): Promise<OrganizationSummary> {
    await mockDelay();
    const organization = findOrganizationById(id);
    if (!organization) {
      throw new ApiError({ message: "Organization not found.", status: 404 });
    }
    return {
      ...organization,
      memberCount: users.filter((user) => user.organizationId === organization.id).length,
    };
  },

  /** Cross-entity — System Admin editing any organization's details, not just their own. */
  async updateById(
    id: string,
    payload: UpdateOrganizationPayload,
  ): Promise<OrganizationSummary> {
    await mockDelay();
    const organization = findOrganizationById(id);
    if (!organization) {
      throw new ApiError({ message: "Organization not found.", status: 404 });
    }
    if (payload.name !== undefined) organization.name = payload.name;
    if (payload.logoUrl !== undefined) organization.logoUrl = payload.logoUrl;
    if (payload.region !== undefined) organization.region = payload.region;
    if (payload.email !== undefined) organization.email = payload.email;
    if (payload.sector !== undefined) organization.sector = payload.sector;
    if (payload.villages !== undefined) organization.villages = payload.villages;
    if (payload.isActive !== undefined) organization.isActive = payload.isActive;
    return {
      ...organization,
      memberCount: users.filter((user) => user.organizationId === organization.id).length,
    };
  },

  /**
   * System Admin creates a brand-new entity and its first NGO Admin together —
   * there's no other path to a new organization in this phase (see roles.ts).
   */
  async createWithAdmin(
    payload: CreateOrganizationPayload,
  ): Promise<OrganizationSummary> {
    await mockDelay();
    if (findUserByEmail(payload.adminEmail)) {
      throw new ApiError({
        message: "An account with this email already exists.",
        status: 409,
      });
    }

    const organization = {
      id: generateId("org"),
      name: payload.name,
      logoUrl: null,
      region: payload.region,
      email: payload.email,
      sector: payload.sector,
      villages: payload.villages,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    organizations.push(organization);

    const ngoAdminRole = roles.find((role) => role.key === "ngo_admin")!;
    const admin = {
      id: generateId("user"),
      organizationId: organization.id,
      roleId: ngoAdminRole.id,
      name: payload.adminName,
      email: payload.adminEmail,
      // Mock-only: a real invite flow would email a set-password link instead.
      password: "password123",
      status: "invited" as const,
      consentedAt: null,
      createdAt: new Date().toISOString(),
    };
    users.push(admin);

    return { ...organization, memberCount: 1 };
  },
};
