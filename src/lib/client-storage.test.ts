import { beforeEach, describe, expect, it } from "vitest";
import { clearRioSessionStorage, isRioStorageKey } from "@/lib/client-storage";

describe("client-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("isRioStorageKey()", () => {
    it("accepts any rio.-prefixed key", () => {
      expect(isRioStorageKey("rio.session")).toBe(true);
      expect(isRioStorageKey("rio.reviewerSla.seenIds.user_1")).toBe(true);
    });

    it("rejects a key without the prefix", () => {
      expect(isRioStorageKey("session")).toBe(false);
      expect(isRioStorageKey("some-other-tool-key")).toBe(false);
    });
  });

  describe("clearRioSessionStorage()", () => {
    it("removes RIO-owned keys from both localStorage and sessionStorage", () => {
      localStorage.setItem("rio.session", "token");
      localStorage.setItem("rio.reviewerSla.seenIds.user_1", "[]");
      sessionStorage.setItem("rio.needEvidenceUploadFailed.need_1", "[]");

      clearRioSessionStorage("user_1");

      expect(localStorage.getItem("rio.session")).toBeNull();
      expect(localStorage.getItem("rio.reviewerSla.seenIds.user_1")).toBeNull();
      expect(sessionStorage.getItem("rio.needEvidenceUploadFailed.need_1")).toBeNull();
    });

    it("leaves an unrelated (non-RIO) key untouched — no origin-wide clear()", () => {
      localStorage.setItem("rio.session", "token");
      localStorage.setItem("some-other-tool-key", "keep-me");
      sessionStorage.setItem("another-unrelated-key", "keep-me-too");

      clearRioSessionStorage("user_1");

      expect(localStorage.getItem("some-other-tool-key")).toBe("keep-me");
      expect(sessionStorage.getItem("another-unrelated-key")).toBe("keep-me-too");
    });

    it("a second user signing in after logout does not inherit the first user's seen-state key", () => {
      // The isolation comes from the key itself embedding the user id, not
      // from what logout clears — confirmed here by simulating exactly that
      // sequence: user A's data, logout, user B reading their own (empty) key.
      localStorage.setItem(
        "rio.reviewerSla.seenIds.user_a",
        JSON.stringify(["alert_1", "alert_2"]),
      );

      clearRioSessionStorage("user_a");

      // User B's own key was never written — reading it must come back empty,
      // and must not somehow resolve to user A's still-cached array.
      expect(localStorage.getItem("rio.reviewerSla.seenIds.user_b")).toBeNull();
      expect(localStorage.getItem("rio.reviewerSla.seenIds.user_a")).toBeNull();
    });

    it("is safe to call with no userId", () => {
      localStorage.setItem("rio.session", "token");
      expect(() => clearRioSessionStorage()).not.toThrow();
      expect(localStorage.getItem("rio.session")).toBeNull();
    });
  });
});
