export interface Evidence {
  id: string;
  studyId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string | null;
  uploadedAt: string;
  /**
   * Only present on the upload response — true when a file with the same
   * sha256 already existed in this study. Advisory: the upload still
   * succeeded and the row exists. `listByStudy` never sets it, so don't
   * render it as durable row state; it's a one-time notice.
   */
  isDuplicate?: boolean;
}
