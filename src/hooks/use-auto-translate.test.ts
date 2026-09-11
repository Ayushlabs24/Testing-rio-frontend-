import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { translateMock } = vi.hoisted(() => ({ translateMock: vi.fn() }));
const localeRef = { current: "ar" as "en" | "ar" };

vi.mock("next-intl", () => ({
  useLocale: () => localeRef.current,
}));
vi.mock("@/services/translation/translation.service", () => ({
  translationService: { translate: translateMock },
}));

const { useAutoTranslate } = await import("@/hooks/use-auto-translate");

describe("useAutoTranslate", () => {
  afterEach(() => {
    translateMock.mockReset();
    localeRef.current = "ar";
  });

  it("returns the original text immediately, with no network call, when the script already matches the UI locale", () => {
    localeRef.current = "en";
    const { result } = renderHook(() => useAutoTranslate("Health"));
    expect(result.current).toEqual({ text: "Health", isTranslating: false });
    expect(translateMock).not.toHaveBeenCalled();
  });

  it("skips text with nothing translatable (numbers/empty)", () => {
    localeRef.current = "ar";
    const { result } = renderHook(() => useAutoTranslate("12345"));
    expect(result.current).toEqual({ text: "12345", isTranslating: false });
    expect(translateMock).not.toHaveBeenCalled();
  });

  // Each case below uses its own distinct source string — the hook's
  // in-tab memo cache is a module-level singleton, so reusing a string
  // across cases would let an earlier case's cached/failed result leak
  // into a later one.

  it("shows the original text while translating, then swaps to the resolved translation", async () => {
    localeRef.current = "ar";
    translateMock.mockResolvedValue({
      translatedText: "الصحة",
      sourceLocale: "en",
      targetLocale: "ar",
      unchanged: false,
    });

    const { result } = renderHook(() => useAutoTranslate("Health access"));
    expect(result.current).toEqual({ text: "Health access", isTranslating: true });

    await waitFor(() => expect(result.current.isTranslating).toBe(false));
    expect(result.current.text).toBe("الصحة");
    expect(translateMock).toHaveBeenCalledWith("Health access", "ar");
  });

  it("keeps showing the original text when the translation call fails", async () => {
    localeRef.current = "ar";
    translateMock.mockRejectedValue(new Error("provider down"));

    const { result } = renderHook(() => useAutoTranslate("Water shortage"));
    // The rejected promise must settle without throwing, falling back to
    // the original text rather than leaving isTranslating stuck at true.
    await waitFor(() =>
      expect(result.current).toEqual({ text: "Water shortage", isTranslating: false }),
    );
  });

  it("only calls the translation service once for the same text+locale across multiple hook instances (in-tab dedupe)", async () => {
    localeRef.current = "ar";
    let resolvePromise!: (v: unknown) => void;
    translateMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const first = renderHook(() => useAutoTranslate("Unique text for dedupe test"));
    const second = renderHook(() => useAutoTranslate("Unique text for dedupe test"));
    expect(translateMock).toHaveBeenCalledTimes(1);

    resolvePromise({
      translatedText: "مترجم",
      sourceLocale: "en",
      targetLocale: "ar",
      unchanged: false,
    });
    await waitFor(() => expect(first.result.current.isTranslating).toBe(false));
    await waitFor(() => expect(second.result.current.isTranslating).toBe(false));
    expect(first.result.current.text).toBe("مترجم");
    expect(second.result.current.text).toBe("مترجم");
  });
});
