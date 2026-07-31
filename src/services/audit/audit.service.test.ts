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
  apiClient: { get: vi.fn(), download: vi.fn() },
}));

describe("auditService", () => {
  beforeEach(() => {
    mockSession.save({ token: "test-token", userId: "user_admin" });
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.download).mockReset();
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
  describe("downloadCsv()", () => {
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
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

    it("goes through apiClient.download with the export path and a default filename", async () => {
      const blob = new Blob(["a,b,c"], { type: "text/csv" });
      vi.mocked(apiClient.download).mockResolvedValue({
        blob,
        filename: "audit-log.csv",
      });

      await auditService.downloadCsv();

      expect(apiClient.download).toHaveBeenCalledWith(
        endpoints.audit.export,
        "audit-log.csv",
        {
          params: {},
        },
      );
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("mirrors the active filters onto the download call, dropping empty ones", async () => {
      vi.mocked(apiClient.download).mockResolvedValue({
        blob: new Blob(),
        filename: "audit-log.csv",
      });

      await auditService.downloadCsv({
        action: "create",
        search: "",
        dateFrom: "2026-01-01",
      });

      expect(apiClient.download).toHaveBeenCalledWith(
        endpoints.audit.export,
        "audit-log.csv",
        {
          params: { action: "create", dateFrom: "2026-01-01" },
        },
      );
    });

    it("uses the filename apiClient.download resolves from Content-Disposition", async () => {
      vi.mocked(apiClient.download).mockResolvedValue({
        blob: new Blob(),
        filename: "audit-log-2026-01-01.csv",
      });

      await auditService.downloadCsv();

      const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
      expect(anchor.download).toBe("audit-log-2026-01-01.csv");
    });
  });
});
