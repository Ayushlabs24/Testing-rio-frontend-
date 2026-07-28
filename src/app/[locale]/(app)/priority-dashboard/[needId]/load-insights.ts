import { needsService } from "@/services/needs/needs.service";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import { responseQualityService } from "@/services/response-quality/response-quality.service";
import type { ResponseQualityResult } from "@/services/response-quality/response-quality.types";
import type { PublicSurveyLink } from "@/services/public-surveys/public-surveys.types";
import {
  severityScoringService,
  type VillagePriorityResult,
} from "@/services/priority/severity-scoring.service";
import { surveysService } from "@/services/surveys/surveys.service";
import type { Need } from "@/services/needs/needs.types";
import type { Survey } from "@/services/surveys/surveys.service";

export interface InsightsSetters {
  setNeed: (need: Need | null) => void;
  setSurvey: (survey: Survey | null) => void;
  setPriorityV2: (result: VillagePriorityResult | null) => void;
  setQualityResults: (results: ResponseQualityResult[]) => void;
}

/**
 * Fetches everything the priority-dashboard detail page needs for one
 * `(needId, surveyLinkId)` combination. Extracted out of the page component
 * so the exact stale-response guarding below is unit-testable without
 * mounting the whole page (which pulls in next-intl, PermissionGuard,
 * usePermission, and half a dozen chart/panel components).
 *
 * `isStale()` is checked before every `setState` call — `needId` (route
 * param) and `surveyLinkId` (scope filter) can both change while an earlier
 * call to this function is still in flight (e.g. switching the Scope Filter
 * twice in quick succession), and without this guard an older request that
 * happens to resolve *after* a newer one would overwrite current state with
 * stale data. This is a discard-if-stale guard, not real cancellation (none
 * of these service methods take an `AbortSignal` today) — a stale response
 * simply becomes a no-op rather than being reported as an error.
 */
export function loadPriorityInsights(
  needId: string,
  surveyLinkId: string | undefined,
  isStale: () => boolean,
  setters: InsightsSetters,
): void {
  const { setNeed, setSurvey, setPriorityV2, setQualityResults } = setters;

  needsService
    .getById(needId)
    .then((result) => {
      if (!isStale()) setNeed(result);
    })
    .catch(() => undefined);

  surveysService
    .getSurveyByNeedId(needId)
    .then((srv) => {
      if (isStale()) return;
      setSurvey(srv);
      if (srv) {
        severityScoringService
          .getVillagePriority(srv.studyId, srv.id, null)
          .then((result) => {
            if (!isStale()) setPriorityV2(result);
          })
          .catch(() => {
            if (!isStale()) setPriorityV2(null);
          });
      }
    })
    .catch(() => undefined);

  responseQualityService
    .list(needId, surveyLinkId)
    .then((result) => {
      if (!isStale()) setQualityResults(result);
    })
    .catch(() => {
      if (!isStale()) setQualityResults([]);
    });
}

export function loadSurveyLinks(
  needId: string,
  isStale: () => boolean,
  setLinks: (links: PublicSurveyLink[]) => void,
): void {
  publicSurveysService
    .listLinks(needId)
    .then((result) => {
      if (!isStale()) setLinks(result);
    })
    .catch(() => {
      if (!isStale()) setLinks([]);
    });
}
