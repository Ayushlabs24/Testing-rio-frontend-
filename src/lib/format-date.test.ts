import { describe, expect, it } from "vitest";
import { formatNumber } from "@/lib/format-date";

describe("formatNumber", () => {
  it("renders Western/Latin digits in English", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
  });

  it("renders Western/Latin digits in Arabic too — never Eastern Arabic-Indic numerals", () => {
    // The regression this guards: ar-SA's default numbering system is
    // Eastern Arabic-Indic (١٬٢٣٤), which the client never asked for — see
    // formatDate's own note on this. A bare `.toLocaleString()` on an
    // Arabic-locale browser would render exactly that.
    const result = formatNumber(1234, "ar");
    expect(result).not.toMatch(/[٠-٩]/);
    expect(result).toMatch(/^1.234$/);
  });

  it("keeps a zero and negative numbers correct in both locales", () => {
    expect(formatNumber(0, "en")).toBe("0");
    expect(formatNumber(0, "ar")).toBe("0");
    expect(formatNumber(-42, "en")).toBe("-42");
  });
});
