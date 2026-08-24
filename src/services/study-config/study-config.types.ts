/** Mirrors the backend's StudyConfigOption response shape exactly. */
export interface StudyConfigOption {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateStudyConfigOptionPayload {
  name: string;
  displayOrder?: number;
}

export interface UpdateStudyConfigOptionPayload {
  name?: string;
  displayOrder?: number;
}
