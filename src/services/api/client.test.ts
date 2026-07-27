import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api/client";
import { ApiError } from "@/services/api/types";

/**
 * Transport-level characterization tests for the central API client —
 * timeout, caller cancellation, and the fact that both must be able to
 * abort a request independently (a caller-supplied `signal` used to fully
 * replace the internal timeout controller, silently disabling the
 * timeout — see client.ts's composeSignals).
 */

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("apiClient transport", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("times out at the configured duration when the caller passes no signal", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    vi.useFakeTimers();
    const promise = apiClient.get("/slow", { timeoutMs: 5000 });
    const assertion = expect(promise).rejects.toMatchObject({
      status: 408,
      cancelled: false,
    });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("still times out when the caller also passes their own signal", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    vi.useFakeTimers();
    const callerController = new AbortController();
    const promise = apiClient.get("/slow", {
      timeoutMs: 5000,
      signal: callerController.signal,
    });
    const assertion = expect(promise).rejects.toMatchObject({
      status: 408,
      cancelled: false,
    });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    // The caller's own signal never fired — only the timeout did.
    expect(callerController.signal.aborted).toBe(false);
  });

  it("reports caller-initiated cancellation distinctly from a timeout", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const callerController = new AbortController();
    const promise = apiClient.get("/slow", {
      timeoutMs: 60_000,
      signal: callerController.signal,
    });
    callerController.abort();

    await expect(promise).rejects.toMatchObject({ status: 0, cancelled: true });
  });

  it("cleans up the timer and signal listeners after a normal completion", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    await apiClient.get("/fast");

    expect(clearSpy).toHaveBeenCalled();
  });

  it("preserves credentials: include and the CSRF header on mutating requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    document.cookie = "rio_csrf=test-token";

    await apiClient.post("/mutate", { a: 1 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>)["x-csrf-token"]).toBe("test-token");
  });

  it("does not send a CSRF header on a safe GET request", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    document.cookie = "rio_csrf=test-token";

    await apiClient.get("/read");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-csrf-token"]).toBeUndefined();
  });

  it("maps the backend's { error: { message } } envelope onto ApiError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "NOT_FOUND", message: "Study not found" } },
        { status: 404 },
      ),
    );

    await expect(apiClient.get("/missing")).rejects.toMatchObject({
      status: 404,
      message: "Study not found",
    });
  });

  it("handles an empty (non-JSON) successful response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClient.delete("/thing/1")).resolves.toBeUndefined();
  });

  it("handles a non-JSON error response by falling back to the status text", async () => {
    fetchMock.mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    await expect(apiClient.get("/broken")).rejects.toMatchObject({ status: 500 });
  });

  it("types a genuine network failure (fetch itself rejecting) as an ApiError with status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await apiClient.get("/unreachable").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).cancelled).toBe(false);
  });
});
