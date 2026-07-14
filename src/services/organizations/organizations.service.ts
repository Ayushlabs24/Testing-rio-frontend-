import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  Organization,
  OrganizationSummary,
  UpdateOrganizationPayload,
} from "@/services/organizations/organizations.types";

/** Shape returned by the real backend's /organizations* endpoints (see organizations.types.ts on the backend). */
interface ApiOrganization {
  id: string;
  name: string;
  purpose: string;
  registrationNumber: string;
  logoUrl: string | null;
  region: string | null;
  email: string | null;
  sector: string | null;
  villages: string[];
  isActive: boolean;
  createdAt: string;
}

interface ApiOrganizationSummary extends ApiOrganization {
  memberCount: number;
}

/** The backend models region/email as nullable; the frontend treats "not set" as "". */
function toOrganization(api: ApiOrganization): Organization {
  return {
    ...api,
    region: api.region ?? "",
    email: api.email ?? "",
    sector: api.sector as Organization["sector"],
  };
}

function toOrganizationSummary(api: ApiOrganizationSummary): OrganizationSummary {
  return { ...toOrganization(api), memberCount: api.memberCount };
}

// listAll/getById are cross-entity, read-only (Center Supervisor viewing
// organizations other than its own). No cross-org write path exists:
// System Admin (the only role that ever had one) is disabled, and the
// backend only exposes PATCH /organizations/current (the caller's own org).
export const organizationsService = {
  async getCurrent(): Promise<Organization> {
    const api = await apiClient.get<ApiOrganization>(endpoints.organizations.current);
    return toOrganization(api);
  },

  async update(payload: UpdateOrganizationPayload): Promise<Organization> {
    const api = await apiClient.patch<ApiOrganization>(
      endpoints.organizations.current,
      payload,
    );
    return toOrganization(api);
  },

  /** Cross-entity, read-only — every org, regardless of the caller's own. */
  async listAll(): Promise<OrganizationSummary[]> {
    const api = await apiClient.get<ApiOrganizationSummary[]>(
      endpoints.organizations.list,
    );
    return api.map(toOrganizationSummary);
  },

  /** Cross-entity, read-only — viewing any organization's details, not just their own. */
  async getById(id: string): Promise<OrganizationSummary> {
    const api = await apiClient.get<ApiOrganizationSummary>(
      endpoints.organizations.byId(id),
    );
    return toOrganizationSummary(api);
  },
};
