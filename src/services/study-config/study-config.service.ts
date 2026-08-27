import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateStudyConfigOptionPayload,
  StudyConfigOption,
  UpdateStudyConfigOptionPayload,
} from "@/services/study-config/study-config.types";

/**
 * Study Type / Target Sector configurable lists (RIO-FR-012, Sprint 2
 * clarification Q3/Q4) — full CRUD against the real backend. Reads are
 * broadly permitted; writes/create/activate/deactivate are restricted
 * server-side to whoever holds methodologyQuestionBank write (System
 * Admin only, per Q31). Both lists start empty until the client's actual
 * value list (Q35 follow-up) lands or a System Admin adds interim values.
 */
export const studyConfigService = {
  async listStudyTypes(): Promise<StudyConfigOption[]> {
    return apiClient.get<StudyConfigOption[]>(endpoints.studyConfig.studyTypes);
  },

  async createStudyType(
    payload: CreateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.post<StudyConfigOption>(endpoints.studyConfig.studyTypes, payload);
  },

  async updateStudyType(
    id: string,
    payload: UpdateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.patch<StudyConfigOption>(
      endpoints.studyConfig.studyTypeById(id),
      payload,
    );
  },

  async setStudyTypeActive(id: string, isActive: boolean): Promise<StudyConfigOption> {
    const path = isActive
      ? endpoints.studyConfig.activateStudyType(id)
      : endpoints.studyConfig.deactivateStudyType(id);
    return apiClient.patch<StudyConfigOption>(path);
  },

  async listTargetSectors(): Promise<StudyConfigOption[]> {
    return apiClient.get<StudyConfigOption[]>(endpoints.studyConfig.targetSectors);
  },

  async createTargetSector(
    payload: CreateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.post<StudyConfigOption>(
      endpoints.studyConfig.targetSectors,
      payload,
    );
  },

  async updateTargetSector(
    id: string,
    payload: UpdateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.patch<StudyConfigOption>(
      endpoints.studyConfig.targetSectorById(id),
      payload,
    );
  },

  async setTargetSectorActive(id: string, isActive: boolean): Promise<StudyConfigOption> {
    const path = isActive
      ? endpoints.studyConfig.activateTargetSector(id)
      : endpoints.studyConfig.deactivateTargetSector(id);
    return apiClient.patch<StudyConfigOption>(path);
  },

  async listDecisionTypes(): Promise<StudyConfigOption[]> {
    return apiClient.get<StudyConfigOption[]>(endpoints.studyConfig.decisionTypes);
  },

  async createDecisionType(
    payload: CreateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.post<StudyConfigOption>(
      endpoints.studyConfig.decisionTypes,
      payload,
    );
  },

  async updateDecisionType(
    id: string,
    payload: UpdateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.patch<StudyConfigOption>(
      endpoints.studyConfig.decisionTypeById(id),
      payload,
    );
  },

  async setDecisionTypeActive(id: string, isActive: boolean): Promise<StudyConfigOption> {
    const path = isActive
      ? endpoints.studyConfig.activateDecisionType(id)
      : endpoints.studyConfig.deactivateDecisionType(id);
    return apiClient.patch<StudyConfigOption>(path);
  },

  // RIO-FR-003 AC 6 — the theme vocabulary the extractor may pick from.
  async listNeedThemes(): Promise<StudyConfigOption[]> {
    return apiClient.get<StudyConfigOption[]>(endpoints.studyConfig.needThemes);
  },

  async createNeedTheme(
    payload: CreateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.post<StudyConfigOption>(endpoints.studyConfig.needThemes, payload);
  },

  async updateNeedTheme(
    id: string,
    payload: UpdateStudyConfigOptionPayload,
  ): Promise<StudyConfigOption> {
    return apiClient.patch<StudyConfigOption>(
      endpoints.studyConfig.needThemeById(id),
      payload,
    );
  },

  async setNeedThemeActive(id: string, isActive: boolean): Promise<StudyConfigOption> {
    const path = isActive
      ? endpoints.studyConfig.activateNeedTheme(id)
      : endpoints.studyConfig.deactivateNeedTheme(id);
    return apiClient.patch<StudyConfigOption>(path);
  },
};
