/** Mirrors the backend's StudyConfigOption response shape exactly. */
export interface StudyConfigOption {
  id: string;
  name: string;
  // RIO Arabic Localization — Approach 3 (Hybrid, client-confirmed
  // 2026-09-04). Null until an admin supplies it — display falls back to
  // `name` (see localizedOptionName()).
  nameAr: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateStudyConfigOptionPayload {
  name: string;
  nameAr?: string;
  displayOrder?: number;
}

export interface UpdateStudyConfigOptionPayload {
  name?: string;
  nameAr?: string;
  displayOrder?: number;
}
