import type { AuditFieldChange } from "@/services/audit/audit.types";

/**
 * Normalises a raw field value into the string (or null) stored on an audit
 * change. Keeps the before/after representation consistent regardless of the
 * source type: booleans become "true"/"false", arrays are comma-joined, and
 * empty/absent values become null so the UI can render them as "not set".
 */
function normalize(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/**
 * Builds an ordered list of before/after changes by comparing two snapshots of
 * the same record. Only fields whose normalised value actually changed are
 * included, so no-op writes don't produce noise in the log. `fields` maps each
 * raw key to the human-readable label shown in the audit trail; iterating it
 * (rather than the objects) fixes display order and scopes the diff to the
 * fields worth auditing.
 */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: Record<string, string>,
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];
  for (const [key, label] of Object.entries(fields)) {
    const from = normalize(before[key]);
    const to = normalize(after[key]);
    if (from !== to) {
      changes.push({ field: label, before: from, after: to });
    }
  }
  return changes;
}
