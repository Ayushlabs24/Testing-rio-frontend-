import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditEvents } from "@/mocks/data/audit";
import { mockSession } from "@/mocks/session";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { auditService } from "@/services/audit/audit.service";
import type { AuditEvent } from "@/services/audit/audit.types";

/**
 * `record()` stays mock-only (see audit.service.ts) — those tests exercise
 * it directly. `list()` calls the real backend now; its filtering/sort-
 * order/immutability guarantees live server-side (see
 * Project-RIO-Backend's audit.service.spec.ts / audit.e2e.spec.ts), so
 * here it's just a thin passthrough over a mocked `apiClient`.
 */
vi.mock("@/services/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

describe("auditService", () => {
  beforeEach(() => {
    mockSession.save({ token: "test-token", userId: "user_admin" });
    vi.mocked(apiClient.get).mockReset();
  });

  it("records an event with the current actor and a timestamp", () => {
    const before = auditEvents.length;
    const event = auditService.record({
      action: "create",
      entityType: "user",
      entityId: "user_new",
      entityLabel: "New Person",
    });

    expect(auditEvents.length).toBe(before + 1);
    expect(event.actor?.id).toBe("user_admin");
    expect(event.action).toBe("create");
    expect(event.entityType).toBe("user");
    expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false);
  });

  it("records before/after changes and freezes them", () => {
    const event = auditService.record({
      action: "edit",
      entityType: "user",
      entityId: "user_reviewer",
      entityLabel: "John Doe",
      changes: [{ field: "Role", before: "Reviewer", after: "Supervisor" }],
    });

    expect(event.changes).toEqual([
      { field: "Role", before: "Reviewer", after: "Supervisor" },
    ]);
    expect(Object.isFrozen(event.changes)).toBe(true);
    expect(Object.isFrozen(event.changes?.[0])).toBe(true);
    expect(() => {
      (event.changes as { after: string }[])[0].after = "Tampered";
    }).toThrow();
  });

  it("records immutable (frozen) events", () => {
    const event = auditService.record({
      action: "edit",
      entityType: "organization",
      entityId: "org_demo",
      entityLabel: "Demo Nonprofit Alliance",
    });

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.actor)).toBe(true);
    expect(() => {
      (event as { action: string }).action = "delete";
    }).toThrow();
    expect(event.action).toBe("edit");
  });

  it("list() calls GET /audit and returns the paginated envelope as-is", async () => {
    const events: AuditEvent[] = [
      {
        id: "audit_1",
        organizationId: "org_demo",
        actor: { id: "user_admin", name: "Alex Morgan", email: "admin@demo.org" },
        action: "edit",
        entityType: "organization",
        entityId: "org_demo",
        entityLabel: "Demo Nonprofit Alliance",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];
    const result = { items: events, total: 1, limit: 50, offset: 0 };
    vi.mocked(apiClient.get).mockResolvedValue(result);

    const list = await auditService.list();

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.audit.list);
    expect(list).toEqual(result);
  });

  it("list() serialises filters and paging into the query string", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      total: 0,
      limit: 25,
      offset: 25,
    });

    await auditService.list({
      action: "login",
      dateFrom: "2026-01-01T00:00:00.000Z",
      dateTo: "2026-01-31T23:59:59.999Z",
      search: "alex",
      limit: 25,
      offset: 25,
    });

    const [url] = vi.mocked(apiClient.get).mock.calls[0];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith(`${endpoints.audit.list}?`)).toBe(true);
    expect(params.get("action")).toBe("login");
    expect(params.get("dateFrom")).toBe("2026-01-01T00:00:00.000Z");
    expect(params.get("dateTo")).toBe("2026-01-31T23:59:59.999Z");
    expect(params.get("search")).toBe("alex");
    expect(params.get("limit")).toBe("25");
    expect(params.get("offset")).toBe("25");
  });

  it("list() omits empty filters rather than sending blank params", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    await auditService.list({ action: undefined, search: "", limit: 50 });

    expect(apiClient.get).toHaveBeenCalledWith(`${endpoints.audit.list}?limit=50`);
  });

  it("requires an authenticated actor to record", () => {
    mockSession.clear();
    expect(() =>
      auditService.record({
        action: "create",
        entityType: "user",
        entityId: "x",
        entityLabel: "x",
      }),
    ).toThrow();
  });

  describe("downloadCsv", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => "blob:mock-url");
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.unstubAllGlobals();
    });

    function mockFetchResponse({
      ok = true,
      status = 200,
      statusText = "OK",
      disposition,
      body,
    }: {
      ok?: boolean;
      status?: number;
      statusText?: string;
      disposition?: string;
      body?: unknown;
    } = {}) {
      const headers = new Headers();
      if (disposition) headers.set("content-disposition", disposition);
      const blob = new Blob(["field,value"], { type: "text/csv" });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok,
          status,
          statusText,
          headers,
          blob: vi.fn().mockResolvedValue(blob),
          json: vi.fn().mockResolvedValue(body),
        }),
      );
    }

    /** Creates a real anchor (jsdom rejects `href`/`download` on a faked prototype) with `click` spied. */
    function spyOnAnchorClick() {
      const clickSpy = vi.fn();
      const anchor = document.createElement("a");
      anchor.click = clickSpy;
      vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);
      return { anchor, clickSpy };
    }

    it("downloads the CSV and triggers a browser save via an anchor click", async () => {
      mockFetchResponse({
        disposition: 'attachment; filename="audit-log-2026-01-01.csv"',
      });
      const { anchor, clickSpy } = spyOnAnchorClick();

      await auditService.downloadCsv();

      const [calledUrl, calledInit] = vi.mocked(global.fetch).mock.calls[0];
      expect((calledUrl as URL).pathname).toBe("/api/audit/export");
      expect(calledInit).toEqual({ credentials: "include" });
      expect(anchor.download).toBe("audit-log-2026-01-01.csv");
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("falls back to a default filename when no content-disposition header is present", async () => {
      mockFetchResponse({});
      const { anchor, clickSpy } = spyOnAnchorClick();

      await auditService.downloadCsv();

      expect(anchor.download).toBe("audit-log.csv");
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("mirrors the active filters into the export query string", async () => {
      mockFetchResponse({});
      spyOnAnchorClick();

      await auditService.downloadCsv({
        action: "login",
        dateFrom: "2026-01-01T00:00:00.000Z",
        dateTo: "2026-01-31T23:59:59.999Z",
        search: "alex",
      });

      const [calledUrl] = vi.mocked(global.fetch).mock.calls[0];
      const url = calledUrl as URL;
      expect(url.searchParams.get("action")).toBe("login");
      expect(url.searchParams.get("dateFrom")).toBe("2026-01-01T00:00:00.000Z");
      expect(url.searchParams.get("dateTo")).toBe("2026-01-31T23:59:59.999Z");
      expect(url.searchParams.get("search")).toBe("alex");
    });

    it("omits empty filters rather than sending blank params", async () => {
      mockFetchResponse({});
      spyOnAnchorClick();

      await auditService.downloadCsv({ action: undefined, search: "" });

      const [calledUrl] = vi.mocked(global.fetch).mock.calls[0];
      const url = calledUrl as URL;
      expect(url.searchParams.has("action")).toBe(false);
      expect(url.searchParams.has("search")).toBe(false);
    });

    it("throws with the server's error message when the export request fails", async () => {
      mockFetchResponse({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        body: { error: { message: "Export failed." } },
      });

      await expect(auditService.downloadCsv()).rejects.toThrow("Export failed.");
    });

    it("falls back to the response status text when the error body can't be parsed", async () => {
      const headers = new Headers();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers,
          json: vi.fn().mockRejectedValue(new Error("not json")),
        }),
      );

      await expect(auditService.downloadCsv()).rejects.toThrow("Internal Server Error");
    });
  });
});
