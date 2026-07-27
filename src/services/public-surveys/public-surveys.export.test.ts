import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";

vi.mock("@/services/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    download: vi.fn(),
  },
}));

describe("publicSurveysService.exportResponses()", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(apiClient.download).mockReset();
    createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clickSpy.mockRestore();
  });

  it("goes through apiClient.download with no surveyLinkId filter when none is given", async () => {
    vi.mocked(apiClient.download).mockResolvedValue({
      blob: new Blob(),
      filename: "survey-responses.csv",
    });

    await publicSurveysService.exportResponses("need_1", "csv");

    expect(apiClient.download).toHaveBeenCalledWith(
      endpoints.publicSurveys.exportResponses("need_1", "csv"),
      "survey-responses.csv",
      { params: undefined },
    );
  });

  it("passes surveyLinkId through as a query param when given, preserving the format query already in the path", async () => {
    vi.mocked(apiClient.download).mockResolvedValue({
      blob: new Blob(),
      filename: "survey-responses.xlsx",
    });

    await publicSurveysService.exportResponses("need_1", "excel", "link_5");

    expect(apiClient.download).toHaveBeenCalledWith(
      endpoints.publicSurveys.exportResponses("need_1", "excel"),
      "survey-responses.xlsx",
      { params: { surveyLinkId: "link_5" } },
    );
  });

  it("defaults filenames per format when Content-Disposition doesn't override them", async () => {
    vi.mocked(apiClient.download).mockResolvedValue({
      blob: new Blob(),
      filename: "survey-responses.csv",
    });

    await publicSurveysService.exportResponses("need_1", "csv");

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("survey-responses.csv");
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});
