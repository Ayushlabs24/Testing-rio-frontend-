import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateNeedDecisionPayload,
  NeedDecision,
  UpdateNeedDecisionStatusPayload,
} from "@/services/need-decisions/need-decisions.types";

/**
 * RIO-FR-005 — Intervention/Follow-up decision logging against a Need.
 * Gated server-side on priorityScoring:create — same permission the
 * Recalculate/Quality-Assessment actions on the Priority Detail page use.
 * create() fails with NO_APPROVED_PRIORITY_SCORE if the Need has no
 * Human-Reviewer-approved priority score yet (Q34).
 */
export const needDecisionsService = {
  async list(needId: string): Promise<NeedDecision[]> {
    return apiClient.get<NeedDecision[]>(endpoints.needDecisions.list(needId));
  },

  async create(
    needId: string,
    payload: CreateNeedDecisionPayload,
  ): Promise<NeedDecision> {
    return apiClient.post<NeedDecision>(endpoints.needDecisions.create(needId), payload);
  },

  async updateStatus(
    needId: string,
    decisionId: string,
    payload: UpdateNeedDecisionStatusPayload,
  ): Promise<NeedDecision> {
    return apiClient.patch<NeedDecision>(
      endpoints.needDecisions.updateStatus(needId, decisionId),
      payload,
    );
  },
};
