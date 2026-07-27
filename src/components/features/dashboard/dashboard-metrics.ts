import type { Need } from "@/services/needs/needs.types";

export function getVerifiedNeedStatusCounts(needs: Need[]) {
  const publishedCount = needs.filter(
    (need) => need.status === "survey_published",
  ).length;
  return {
    publishedCount,
    draftCount: needs.length - publishedCount,
  };
}

export const NO_RECORDED_RESPONSES = 0;
