import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("list() calls GET /audit and returns the response as-is", async () => {
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
    vi.mocked(apiClient.get).mockResolvedValue(events);

    const list = await auditService.list();

    expect(apiClient.get).toHaveBeenCalledWith(endpoints.audit.list);
    expect(list).toEqual(events);
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
});
