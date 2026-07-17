/** Mirrors the backend's Domain/SubDomain Master Module response shape exactly. */
export interface Domain {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SubDomain {
  id: string;
  domainId: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

/** A domain with its sub-domains nested — from `GET /domains/tree`, one
 * request instead of listing domains then fetching each one's sub-domains
 * separately. */
export interface DomainWithSubDomains extends Domain {
  subDomains: SubDomain[];
}

/** From `GET /domains/public` — reachable pre-login (signup form), so just
 * the name, nothing else. */
export interface PublicDomainOption {
  name: string;
}

export interface CreateDomainPayload {
  code: string;
  name: string;
  displayOrder?: number;
}

export interface UpdateDomainPayload {
  code?: string;
  name?: string;
  displayOrder?: number;
}

export interface CreateSubDomainPayload {
  code: string;
  name: string;
  displayOrder?: number;
}

export interface UpdateSubDomainPayload {
  code?: string;
  name?: string;
  displayOrder?: number;
}
