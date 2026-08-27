import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { Need } from "@/services/needs/needs.types";

/** RIO-FR-003 AC 1 — the urgency levels a reviewer can assign.
 *
 * The keys match the backend contract and the default
 * `priorityFactorScales.urgency` map. Kept as a const array rather than
 * hardcoded in a component so the dropdown and the type cannot drift. */
export const URGENCY_LEVELS = [
  "immediate",
  "this_cycle",
  "next_cycle",
  "no_fixed_timeline",
] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export interface ThemeCount {
  theme: string;
  needCount: number;
}

export const needThemesService = {
  /** RIO-FR-003 AC 1. Null clears it — an unset urgency is reported as
   *  "not set" and scored as unmeasured, never as "not urgent". */
  async setUrgency(needId: string, urgency: UrgencyLevel | null): Promise<Need> {
    return apiClient.patch<Need>(endpoints.needs.urgency(needId), { urgency });
  },

  /** Re-runs extraction — used after the statement changed, or when the
   *  reviewer thinks the themes are wrong. */
  async extract(needId: string): Promise<string[]> {
    return apiClient.post<string[]>(endpoints.needs.extractThemes(needId));
  },

  /** RIO-FR-003 AC 6's grouping — every theme in use with its need count. */
  async listCounts(signal?: AbortSignal): Promise<ThemeCount[]> {
    return apiClient.get<ThemeCount[]>(endpoints.needs.themeCounts, { signal });
  },
};
