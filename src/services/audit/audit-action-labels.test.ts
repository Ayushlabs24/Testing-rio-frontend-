import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";

/**
 * Every `AuditAction` the backend can emit needs a label in
 * `app.settings.audit.actions`, or the Audit Log renders an
 * `IntlError: MISSING_MESSAGE` and falls back to a de-prefixed, title-cased
 * version of the raw enum value.
 *
 * The two lists had drifted badly: 24 backend actions had no label at all,
 * and 10 labels existed for action names the backend never emits (invented
 * ones like `SYSTEM_ADMIN_CREATED_ORGANIZATION`, where the real value is
 * `ORGANIZATION_CREATED`). The fallback hid the first problem in the UI while
 * the console filled with errors, and nothing surfaced the second at all.
 *
 * This test reads the backend's `AuditAction` union directly, so adding an
 * action there without a label — or leaving a label behind when one is
 * renamed — fails here.
 */

const BACKEND_AUDIT_TYPES = join(
  process.cwd(),
  "..",
  "Project-RIO-Backend",
  "src",
  "modules",
  "audit",
  "audit.types.ts",
);

function backendActions(): string[] {
  const source = readFileSync(BACKEND_AUDIT_TYPES, "utf8");
  const union = /export type AuditAction =([\s\S]*?);/.exec(source);
  if (!union) throw new Error("Could not find the AuditAction union in audit.types.ts");
  return [...union[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const labels = (
  en as { app: { settings: { audit: { actions: Record<string, string> } } } }
).app.settings.audit.actions;

describe("audit action labels", () => {
  const actions = backendActions();

  it("reads the backend action union", () => {
    // Guards the parser: a moved file or renamed type would otherwise make
    // the assertions below pass against an empty list.
    expect(actions.length).toBeGreaterThan(30);
    expect(actions).toContain("create");
  });

  it("has a label for every action the backend can emit", () => {
    expect(actions.filter((a) => !(a in labels))).toEqual([]);
  });

  it("has no label for an action the backend never emits", () => {
    expect(Object.keys(labels).filter((k) => !actions.includes(k))).toEqual([]);
  });

  it("has a non-empty label for each action", () => {
    expect(Object.entries(labels).filter(([, v]) => !v.trim())).toEqual([]);
  });
});
