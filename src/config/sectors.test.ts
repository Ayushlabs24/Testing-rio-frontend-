import { describe, expect, it } from "vitest";
import { SECTORS, toSector } from "@/config/sectors";

describe("toSector", () => {
  it("passes a known sector through unchanged", () => {
    for (const sector of SECTORS) {
      expect(toSector(sector)).toBe(sector);
    }
  });

  it("maps an unknown backend value to null instead of leaking it", () => {
    // A value the UI has no translation for must not reach `tSectors(...)`.
    expect(toSector("crypto")).toBeNull();
    expect(toSector("HEALTHCARE")).toBeNull(); // case-sensitive: not a known key
  });

  it("treats null/undefined/empty as not set", () => {
    expect(toSector(null)).toBeNull();
    expect(toSector(undefined)).toBeNull();
    expect(toSector("")).toBeNull();
  });
});
