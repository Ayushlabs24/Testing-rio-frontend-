export interface HistoricalStudy {
  id: string;
  orgId: string;
  orgName: string;
  title: string;
  region: string[];
  governorateIds: string[];
  governorateNames: string[];
  centerIds: string[];
  centerNames: string[];
  targetSector: string | null;
  studyDate: string;
  author: string;
  methodologyVersionLabel: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
}

export interface CreateHistoricalStudyPayload {
  title: string;
  region: string[];
  governorateIds: string[];
  centerIds: string[];
  targetSector?: string;
  studyDate: string;
  author: string;
  methodologyVersionLabel: string;
  file: File;
}
