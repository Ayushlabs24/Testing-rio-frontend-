export interface Evidence {
  id: string;
  studyId: string;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
}
