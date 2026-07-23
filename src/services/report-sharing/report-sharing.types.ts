import type { SharingStatus } from "@/services/sharing/sharing.types";

export type { SharingStatus };

export interface ReportSharingRequest {
  id: string;
  ownerOrgId: string;
  ownerOrgName: string;
  requestingOrgId: string;
  requestingOrgName: string;
  reportId: string;
  reportTitle: string;
  status: SharingStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  decisionNote: string | null;
}

export interface CreateReportSharingRequestPayload {
  ownerOrgId: string;
  reportId: string;
  /** "Purpose" in the UI — required. */
  note: string;
}

export interface DecideReportSharingRequestPayload {
  note?: string;
}

export interface SharedReportSnapshot {
  reportId: string;
  title: string;
  reportType: string;
  content: Record<string, unknown>;
  generatedAt: string;
  ownerOrgName: string;
  generatedByName: string | null;
}

export interface OrgLookupResult {
  id: string;
  name: string;
}

export interface ReportLookupResult {
  id: string;
  title: string;
}
