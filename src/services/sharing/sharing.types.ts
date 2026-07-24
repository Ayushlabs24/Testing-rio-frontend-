export type SharingStatus = "pending" | "approved" | "rejected" | "expired";

export interface SharingRequest {
  id: string;
  ownerOrgId: string;
  ownerOrgName: string;
  requestingOrgId: string;
  requestingOrgName: string;
  studyId: string;
  studyTitle: string;
  status: SharingStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  decisionNote: string | null;
}

export interface CreateSharingRequestPayload {
  ownerOrgId: string;
  studyId: string;
  /** "Purpose" in the UI — required. */
  note: string;
}

export interface DecideSharingRequestPayload {
  note?: string;
}

export interface SharedStudySnapshot {
  studyId: string;
  title: string;
  status: string;
  needStatement: string | null;
  needVillages: string[];
  evidenceCount: number;
}

export interface OrgLookupResult {
  id: string;
  name: string;
}

export interface StudyLookupResult {
  id: string;
  title: string;
}
