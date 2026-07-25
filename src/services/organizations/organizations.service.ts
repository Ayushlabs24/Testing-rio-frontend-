import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateOrganizationPayload,
  Organization,
  OrganizationSummary,
  UpdateOrganizationPayload,
  UpdateOrganizationStatusPayload,
} from "@/services/organizations/organizations.types";

/** Shape returned by the real backend's /organizations* endpoints (see organizations.types.ts on the backend). */
interface ApiOrganization {
  id: string;
  name: string;
  purpose: string;
  registrationNumber: string;
  logoUrl: string | null;
  region: string[];
  email: string | null;
  sector: string | null;
  villages: string[];
  regionId: string | null;
  governorateIds: string[];
  centerIds: string[];
  isActive: boolean;
  createdAt: string;
}

interface ApiOrganizationSummary extends ApiOrganization {
  memberCount: number;
  studyCount?: number;
  surveyCount?: number;
  reportCount?: number;
  ngoAdminName?: string | null;
  ngoAdminEmail?: string | null;
  deactivationReason?: string | null;
}

/** The backend models email as nullable; the frontend treats "not set" as "". */
function toOrganization(api: ApiOrganization): Organization {
  return {
    ...api,
    email: api.email ?? "",
  };
}

function toOrganizationSummary(api: ApiOrganizationSummary): OrganizationSummary {
  return {
    ...toOrganization(api),
    memberCount: api.memberCount,
    studyCount: api.studyCount ?? 0,
    surveyCount: api.surveyCount ?? 0,
    reportCount: api.reportCount ?? 0,
    ngoAdminName: api.ngoAdminName ?? null,
    ngoAdminEmail: api.ngoAdminEmail ?? null,
    deactivationReason: api.deactivationReason ?? null,
  };
}

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

  async create(payload: CreateOrganizationPayload): Promise<Organization> {
    const api = await apiClient.post<ApiOrganization>(
      endpoints.organizations.create,
      payload,
    );
    return toOrganization(api);
  },

  async updateStatus(
    id: string,
    payload: UpdateOrganizationStatusPayload,
  ): Promise<OrganizationSummary> {
    const api = await apiClient.patch<ApiOrganizationSummary>(
      endpoints.organizations.status(id),
      payload,
    );
    return toOrganizationSummary(api);
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
