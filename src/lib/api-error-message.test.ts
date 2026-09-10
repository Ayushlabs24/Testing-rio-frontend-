import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import { ApiError } from "@/services/api/types";
import { GLOBAL_API_ERROR_CODES, resolveApiErrorMessage } from "@/lib/api-error-message";

/**
 * The old catch-block pattern (`error instanceof ApiError ? error.message :
 * fallback`) leaked the backend's raw English message on the Arabic UI for
 * every real API rejection. `resolveApiErrorMessage` replaces it: a known
 * backend code resolves to its localized `apiErrors.<code>` string, anything
 * else falls back to the call site's own translated message — the raw
 * `ApiError.message` is never returned.
 */

const enCodes = Object.keys((en as { apiErrors: Record<string, string> }).apiErrors);
const arCodes = Object.keys((ar as { apiErrors: Record<string, string> }).apiErrors);

describe("GLOBAL_API_ERROR_CODES stays in sync with the apiErrors namespace", () => {
  it("lists exactly the codes present in messages/en.json", () => {
    expect([...GLOBAL_API_ERROR_CODES].sort()).toEqual([...enCodes].sort());
  });

  it("has an Arabic entry for every English entry", () => {
    expect(enCodes.filter((c) => !arCodes.includes(c))).toEqual([]);
    expect(arCodes.filter((c) => !enCodes.includes(c))).toEqual([]);
  });

  it("has a non-empty Arabic string for each code", () => {
    const messages = (ar as { apiErrors: Record<string, string> }).apiErrors;
    expect(Object.entries(messages).filter(([, v]) => !v.trim())).toEqual([]);
  });
});

describe("resolveApiErrorMessage", () => {
  const t = (key: string) => `apiErrors.${key}`;
  const fallback = "context-specific fallback";

  it("maps a known ApiError code to its localized apiErrors entry", () => {
    const err = new ApiError({
      message: "Invalid email or password",
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(resolveApiErrorMessage(err, t, fallback)).toBe(
      "apiErrors.INVALID_CREDENTIALS",
    );
  });

  it("returns the fallback for an ApiError with an unmapped code", () => {
    const err = new ApiError({
      message: "Some unmapped backend message",
      status: 500,
      code: "SOME_BRAND_NEW_CODE",
    });
    expect(resolveApiErrorMessage(err, t, fallback)).toBe(fallback);
  });

  it("returns the fallback for an ApiError with no code", () => {
    const err = new ApiError({ message: "Request timed out", status: 408 });
    expect(resolveApiErrorMessage(err, t, fallback)).toBe(fallback);
  });

  it("returns the fallback for a non-ApiError (e.g. a network failure)", () => {
    expect(resolveApiErrorMessage(new Error("network down"), t, fallback)).toBe(fallback);
    expect(resolveApiErrorMessage("nope", t, fallback)).toBe(fallback);
  });

  it("never returns the raw ApiError.message", () => {
    const err = new ApiError({
      message: "RAW ENGLISH LEAK",
      status: 400,
      code: "NOT_IN_LIST",
    });
    expect(resolveApiErrorMessage(err, t, fallback)).not.toContain("RAW ENGLISH LEAK");
  });
});
