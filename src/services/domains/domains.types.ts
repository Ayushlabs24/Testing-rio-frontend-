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
