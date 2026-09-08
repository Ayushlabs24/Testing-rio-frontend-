/** Mirrors the backend's Domain/SubDomain Master Module response shape exactly. */
export interface Domain {
  id: string;
  code: string;
  name: string;
  // RIO Arabic Localization — Approach 3 (Hybrid, client-confirmed
  // 2026-09-04). Null until an admin supplies it — display falls back to
  // `name` (see localizedName() in @/lib/bilingual).
  nameAr: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface SubDomain {
  id: string;
  domainId: string;
  code: string;
  name: string;
  nameAr: string | null;
  displayOrder: number;
  isActive: boolean;
}

/** A domain with its sub-domains nested — from `GET /domains/tree`, one
 * request instead of listing domains then fetching each one's sub-domains
 * separately. */
export interface DomainWithSubDomains extends Domain {
  subDomains: SubDomain[];
}

/** From `GET /domains/public` — reachable pre-login (signup form). */
export interface PublicDomainOption {
  name: string;
  // RIO Arabic Localization (Approach 3, Hybrid) — the Sign Up sector
  // dropdown needs this the same as every authenticated Domain read does.
  nameAr: string | null;
}

/** From `GET /domains/public/tree` — same "name-only, nothing sensitive"
 * posture as PublicDomainOption, extended with sub-domains. Reachable by
 * every role regardless of `methodologyQuestionBank` grant, unlike
 * `DomainWithSubDomains` from `/domains/tree` — see useDomainArabicMap,
 * which needs this from roles (e.g. ngo_admin) that hold no such grant. */
export interface PublicDomainTreeOption {
  name: string;
  nameAr: string | null;
  subDomains: { name: string; nameAr: string | null }[];
}

export interface CreateDomainPayload {
  code: string;
  name: string;
  nameAr?: string;
  displayOrder?: number;
}

export interface UpdateDomainPayload {
  code?: string;
  name?: string;
  nameAr?: string;
  displayOrder?: number;
}

export interface CreateSubDomainPayload {
  code: string;
  name: string;
  nameAr?: string;
  displayOrder?: number;
}

export interface UpdateSubDomainPayload {
  code?: string;
  name?: string;
  nameAr?: string;
  displayOrder?: number;
}
