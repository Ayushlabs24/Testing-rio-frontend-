import { describe, expect, it } from "vitest";
import {
  isValidRegistrationNumberShape,
  normalizeRegistrationNumber,
} from "@/lib/registration-number";

// This has to agree with the backend's nic-number.util.ts — a client fold
// stricter than the server's would block registrants the server would accept.
describe("normalizeRegistrationNumber", () => {
  it("strips the separators people type or paste", () => {
    expect(normalizeRegistrationNumber(" 7011-038-218 ")).toBe("7011038218");
    expect(normalizeRegistrationNumber("7011 038 218")).toBe("7011038218");
  });

  it("folds Arabic-Indic digits to ASCII", () => {
    expect(normalizeRegistrationNumber("٧٠١١٠٣٨٢١٨")).toBe("7011038218");
    expect(normalizeRegistrationNumber("۷۰۱۱۰۳۸۲۱۸")).toBe("7011038218");
  });
});

describe("isValidRegistrationNumberShape", () => {
  it.each(["7011038218", " 7011-038-218 ", "٧٠١١٠٣٨٢١٨"])("accepts %s", (input) => {
    expect(isValidRegistrationNumberShape(input)).toBe(true);
  });

  it.each(["", "NGO123456", "701103821", "70110382180", "7011038218INVALID"])(
    "rejects %s",
    (input) => {
      expect(isValidRegistrationNumberShape(input)).toBe(false);
    },
  );
});
