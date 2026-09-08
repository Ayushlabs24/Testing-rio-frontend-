import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateDomainPayload,
  CreateSubDomainPayload,
  Domain,
  DomainWithSubDomains,
  PublicDomainOption,
  PublicDomainTreeOption,
  SubDomain,
  UpdateDomainPayload,
  UpdateSubDomainPayload,
} from "@/services/domains/domains.types";

/**
 * Domain/Subdomain Master Module — full CRUD against the real backend.
 * Reads are broadly permitted; writes/create/activate/deactivate are
 * restricted server-side to ngo_admin (methodologyQuestionBank write).
 */
export const domainsService = {
  /** Active domain names only — reachable pre-login, backs the sector
   * dropdown on the public signup form. Use `list()` instead once signed in. */
  async listPublic(): Promise<PublicDomainOption[]> {
    return apiClient.get<PublicDomainOption[]>(endpoints.domains.public);
  },

  async list(): Promise<Domain[]> {
    return apiClient.get<Domain[]>(endpoints.domains.list);
  },

  /** One request for every domain's sub-domains, nested — use this instead
   * of `list()` + one `listSubDomains()` call per domain. Requires
   * `methodologyQuestionBank:read` — most roles (e.g. ngo_admin) don't hold
   * it; use `listPublicTree()` instead for the app-wide name→Arabic-name
   * lookup (see useDomainArabicMap). */
  async listWithSubDomains(): Promise<DomainWithSubDomains[]> {
    return apiClient.get<DomainWithSubDomains[]>(endpoints.domains.tree);
  },

  /** Name + Arabic-name only, domains and sub-domains, reachable by every
   * role regardless of `methodologyQuestionBank` grant — see
   * PublicDomainTreeOption's own comment. */
  async listPublicTree(): Promise<PublicDomainTreeOption[]> {
    return apiClient.get<PublicDomainTreeOption[]>(endpoints.domains.publicTree);
  },

  async create(payload: CreateDomainPayload): Promise<Domain> {
    return apiClient.post<Domain>(endpoints.domains.create, payload);
  },

  async update(id: string, payload: UpdateDomainPayload): Promise<Domain> {
    return apiClient.patch<Domain>(endpoints.domains.byId(id), payload);
  },

  async setActive(id: string, isActive: boolean): Promise<Domain> {
    const path = isActive
      ? endpoints.domains.activate(id)
      : endpoints.domains.deactivate(id);
    return apiClient.patch<Domain>(path);
  },

  async listSubDomains(domainId: string): Promise<SubDomain[]> {
    return apiClient.get<SubDomain[]>(endpoints.domains.subDomains(domainId));
  },

  async createSubDomain(
    domainId: string,
    payload: CreateSubDomainPayload,
  ): Promise<SubDomain> {
    return apiClient.post<SubDomain>(endpoints.domains.subDomains(domainId), payload);
  },

  async updateSubDomain(
    domainId: string,
    id: string,
    payload: UpdateSubDomainPayload,
  ): Promise<SubDomain> {
    return apiClient.patch<SubDomain>(
      endpoints.domains.subDomainById(domainId, id),
      payload,
    );
  },

  async setSubDomainActive(
    domainId: string,
    id: string,
    isActive: boolean,
  ): Promise<SubDomain> {
    const path = isActive
      ? endpoints.domains.activateSubDomain(domainId, id)
      : endpoints.domains.deactivateSubDomain(domainId, id);
    return apiClient.patch<SubDomain>(path);
  },
};
