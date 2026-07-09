import { beforeEach, describe, expect, it } from "vitest";
import { auditEvents } from "@/mocks/data/audit";
import { mockSession } from "@/mocks/session";
import { auditService } from "@/services/audit/audit.service";

describe("auditService", () => {
  beforeEach(() => {
    mockSession.save({ token: "test-token", userId: "user_admin" });
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

  it("never exposes the underlying store through list()", async () => {
    auditService.record({
      action: "share",
      entityType: "report",
      entityId: "report_1",
      entityLabel: "Q1 Needs Report",
    });

    const list = await auditService.list();
    const storedLength = auditEvents.length;

    // Pushing to / mutating the returned array must not affect the store.
    list.push(list[0]);
    if (list[0].actor) list[0].actor.name = "Tampered";

    const fresh = await auditService.list();
    expect(auditEvents.length).toBe(storedLength);
    expect(fresh.every((event) => event.actor?.name !== "Tampered")).toBe(true);
  });

  it("returns this organisation's history newest-first", async () => {
    const list = await auditService.list();
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i - 1].createdAt >= list[i].createdAt).toBe(true);
    }
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
