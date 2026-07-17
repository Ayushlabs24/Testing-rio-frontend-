export interface Need {
  id: string;
  studyId: string;
  statement: string;
  village: string[];
  source: string;
  createdAt: string;
}

export interface CreateNeedPayload {
  statement: string;
  village: string[];
  source: string;
}

export interface UpdateNeedPayload {
  statement?: string;
  village?: string[];
  source?: string;
}
