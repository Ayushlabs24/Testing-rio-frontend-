import { beforeEach, describe, expect, it, vi } from "vitest";
import { needsService } from "@/services/needs/needs.service";
import { responseQualityService } from "@/services/response-quality/response-quality.service";
import { surveysService } from "@/services/surveys/surveys.service";
import { loadPriorityInsights } from "./load-insights";

/**
 * Reproduces and verifies the fix for the stale-response race: `needId`/
 * `surveyLinkId` can change while an earlier request for the previous
 * value is still in flight (e.g. switching the Scope Filter twice quickly).
 * Without the `isStale()` guard, an older request resolving *after* a
 * newer one would overwrite current state with stale data.
 */
vi.mock("@/services/needs/needs.service", () => ({
  needsService: { getById: vi.fn() },
}));
vi.mock("@/services/surveys/surveys.service", () => ({
  surveysService: { getPublishedSurveyByNeedId: vi.fn() },
}));
vi.mock("@/services/response-quality/response-quality.service", () => ({
  responseQualityService: { list: vi.fn() },
}));
vi.mock("@/services/priority/severity-scoring.service", () => ({
  severityScoringService: { getVillagePriority: vi.fn().mockResolvedValue(null) },
}));

/** A promise the test controls the resolution timing of. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("loadPriorityInsights — stale-response guard", () => {
  const setters = {
    setNeed: vi.fn(),
    setSurvey: vi.fn(),
    setPriorityV2: vi.fn(),
    setQualityResults: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(needsService.getById).mockReset();
    vi.mocked(surveysService.getPublishedSurveyByNeedId).mockReset();
    vi.mocked(responseQualityService.list).mockReset();
    setters.setNeed.mockReset();
    setters.setSurvey.mockReset();
    setters.setPriorityV2.mockReset();
    setters.setQualityResults.mockReset();
  });

  it("discards an older request's result when it resolves after a newer request for a different needId", async () => {
    const requestA = deferred<{ id: string; title: string }>();
    const requestB = deferred<{ id: string; title: string }>();
    vi.mocked(needsService.getById)
      .mockReturnValueOnce(requestA.promise as never)
      .mockReturnValueOnce(requestB.promise as never);
    vi.mocked(surveysService.getPublishedSurveyByNeedId).mockResolvedValue(null);
    vi.mocked(responseQualityService.list).mockResolvedValue([]);

    // Request A starts (needId changes to "need_a")...
    let staleA = false;
    loadPriorityInsights("need_a", undefined, () => staleA, setters);

    // ...then the parameter changes before A resolves — this is what a
    // real effect's cleanup function does (see the page's useEffect).
    staleA = true;
    const staleB = false;
    loadPriorityInsights("need_b", undefined, () => staleB, setters);

    // B resolves first, then the stale A resolves after it.
    requestB.resolve({ id: "need_b", title: "Need B" });
    await Promise.resolve();
    requestA.resolve({ id: "need_a", title: "Need A" });
    await Promise.resolve();
    await Promise.resolve();

    // setNeed must only ever have been called with B's result — A's late
    // arrival must never have overwritten it.
    expect(setters.setNeed).toHaveBeenCalledTimes(1);
    expect(setters.setNeed).toHaveBeenCalledWith({ id: "need_b", title: "Need B" });
  });

  it("discards an older request's result when the surveyLinkId (scope filter) changes mid-flight", async () => {
    const requestA = deferred<unknown[]>();
    const requestB = deferred<unknown[]>();
    vi.mocked(needsService.getById).mockResolvedValue({ id: "need_1" } as never);
    vi.mocked(surveysService.getPublishedSurveyByNeedId).mockResolvedValue(null);
    vi.mocked(responseQualityService.list)
      .mockReturnValueOnce(requestA.promise as never)
      .mockReturnValueOnce(requestB.promise as never);

    let staleA = false;
    loadPriorityInsights("need_1", "link_old", () => staleA, setters);
    staleA = true;
    const staleB = false;
    loadPriorityInsights("need_1", "link_new", () => staleB, setters);

    requestB.resolve([{ id: "result_b" }]);
    await Promise.resolve();
    requestA.resolve([{ id: "result_a" }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(setters.setQualityResults).toHaveBeenCalledTimes(1);
    expect(setters.setQualityResults).toHaveBeenCalledWith([{ id: "result_b" }]);
  });

  it("still applies a request's result normally when nothing superseded it", async () => {
    vi.mocked(needsService.getById).mockResolvedValue({
      id: "need_1",
      title: "Only Need",
    } as never);
    vi.mocked(surveysService.getPublishedSurveyByNeedId).mockResolvedValue(null);
    vi.mocked(responseQualityService.list).mockResolvedValue([]);

    loadPriorityInsights("need_1", undefined, () => false, setters);
    await Promise.resolve();
    await Promise.resolve();

    expect(setters.setNeed).toHaveBeenCalledWith({ id: "need_1", title: "Only Need" });
  });
});
