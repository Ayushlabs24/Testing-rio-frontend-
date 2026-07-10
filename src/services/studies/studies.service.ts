import { studies } from "@/mocks/data/studies";
import { mockDelay } from "@/mocks/utils";
import type { PlatformStudyStats } from "@/services/studies/studies.types";

export const studiesService = {
  /** Cross-entity — every organization's studies, not just the caller's own. */
  async getPlatformStats(): Promise<PlatformStudyStats> {
    await mockDelay();
    return {
      activeStudies: studies.filter((study) => study.status === "active").length,
      pendingReviews: studies.filter((study) => study.reviewStatus === "pending").length,
      reportsGenerated: studies.filter((study) => study.reportGenerated).length,
    };
  },
};
