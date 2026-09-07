export type AnalyticalStatus =
  | "observed"
  | "under_analysis"
  | "documented_in_study"
  | "linked_to_initiative"
  | "open_gap";

// Client feedback 2026-09-07 — mirrors the backend's SUPPORTED_CURRENCIES.
export const SUPPORTED_CURRENCIES = ["SAR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export interface Initiative {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  domain: string | null;
  geography: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  status: string;
  fundingSource: string | null;
  description: string | null;
  budget: string | null;
  currency: string;
  /** Owner-controlled (RIO-FR-009, Q15) — off by default. When true, every
   * other entity can see this initiative (read-only); only the owning
   * organisation can ever edit it regardless of this flag. */
  openToOtherEntities: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  linkedNeedCount: number;
}

export interface CreateInitiativePayload {
  name: string;
  domain?: string;
  geography?: string;
  startDate?: string;
  expectedEndDate?: string;
  status?: string;
  fundingSource?: string;
  description?: string;
  budget?: number;
  /** Defaults to SAR server-side when omitted. */
  currency?: Currency;
  openToOtherEntities?: boolean;
}

export type UpdateInitiativePayload = Partial<CreateInitiativePayload>;

export interface NeedAnalyticalStatusEvent {
  id: string;
  fromStatus: AnalyticalStatus | null;
  toStatus: AnalyticalStatus;
  changedBy: string | null;
  changedAt: string;
  note: string | null;
}
