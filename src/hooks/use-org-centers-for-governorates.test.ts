import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Center } from "@/services/geography/geography.types";
import type { Organization } from "@/services/organizations/organizations.types";

const { getCurrentMock, listCentersMock } = vi.hoisted(() => ({
  getCurrentMock: vi.fn(),
  listCentersMock: vi.fn(),
}));

vi.mock("@/services/organizations/organizations.service", () => ({
  organizationsService: { getCurrent: getCurrentMock },
}));
vi.mock("@/services/geography/geography.service", () => ({
  geographyService: { listCenters: listCentersMock },
}));

const { useOrgCentersForGovernorates } =
  await import("@/hooks/use-org-centers-for-governorates");

const centers: Center[] = [
  {
    id: "center-allowed",
    code: "001",
    governorateId: "gov-1",
    name: "Allowed Center",
    category: "A",
  },
  {
    id: "center-foreign",
    code: "002",
    governorateId: "gov-1",
    name: "Foreign Center",
    category: "A",
  },
];

function organization(centerIds?: string[]): Organization {
  const org = {
    id: "org-1",
    name: "Tenant Organization",
    purpose: "Research",
    registrationNumber: "REG-1",
    logoUrl: null,
    region: [],
    email: "org@example.com",
    sector: null,
    villages: [],
    regionId: null,
    governorateIds: ["gov-1"],
    isActive: true,
    createdAt: "2026-08-04T00:00:00.000Z",
  };

  return centerIds === undefined
    ? (org as unknown as Organization)
    : { ...org, centerIds };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useOrgCentersForGovernorates", () => {
  it("returns no centers when the organization has an empty center selection", async () => {
    getCurrentMock.mockResolvedValue(organization([]));
    listCentersMock.mockResolvedValue(centers);

    const { result } = renderHook(() => useOrgCentersForGovernorates(["gov-1"]));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.centers).toEqual([]);
  });

  it("returns no centers when the organization response omits center IDs", async () => {
    getCurrentMock.mockResolvedValue(organization());
    listCentersMock.mockResolvedValue(centers);

    const { result } = renderHook(() => useOrgCentersForGovernorates(["gov-1"]));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.centers).toEqual([]);
  });

  it("retains configured centers while filtering out foreign geography centers", async () => {
    getCurrentMock.mockResolvedValue(organization(["center-allowed"]));
    listCentersMock.mockResolvedValue(centers);

    const { result } = renderHook(() => useOrgCentersForGovernorates(["gov-1"]));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.centers).toEqual([centers[0]]);
  });

  it("hides centers from the prior key while the next key is pending and after it fails", async () => {
    let rejectNextCenters!: (reason: unknown) => void;
    const nextCenters = new Promise<Center[]>((_, reject) => {
      rejectNextCenters = reject;
    });
    getCurrentMock.mockResolvedValue(organization(["center-allowed"]));
    listCentersMock.mockResolvedValueOnce(centers).mockReturnValueOnce(nextCenters);

    const { result, rerender } = renderHook(
      ({ governorateIds }: { governorateIds: string[] }) =>
        useOrgCentersForGovernorates(governorateIds),
      { initialProps: { governorateIds: ["gov-1"] } },
    );

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.centers).toEqual([centers[0]]);

    rerender({ governorateIds: ["gov-2"] });

    expect(result.current.loaded).toBe(false);
    expect(result.current.centers).toEqual([]);

    await act(async () => {
      rejectNextCenters(new Error("governorate lookup failed"));
      await nextCenters.catch(() => undefined);
    });

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.centers).toEqual([]);
  });
});
