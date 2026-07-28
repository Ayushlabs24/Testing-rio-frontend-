// Mirrors the backend's flattening in reports/report-content-flatten.ts —
// same idea, presented as UI sections instead of spreadsheet rows: each
// report type's `content` is a differently-shaped object (see
// reports.service.ts#generateContent on the backend), so this walks it
// generically rather than needing a bespoke view per report type.

export interface FlattenedReportContent {
  narrative: string | null;
  summaryRows: Array<{ field: string; value: string }>;
  tables: Array<{ name: string; rows: Array<Record<string, unknown>> }>;
}

function isArrayOfObjects(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null
  );
}

function isArrayOfScalars(value: unknown): value is Array<string | number | boolean> {
  return Array.isArray(value) && value.length > 0 && !isArrayOfObjects(value);
}

function stringifyScalar(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (isArrayOfScalars(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

export function flattenReportContent(
  content: Record<string, unknown>,
): FlattenedReportContent {
  const narrative = typeof content.narrative === "string" ? content.narrative : null;
  const summaryRows: FlattenedReportContent["summaryRows"] = [];
  const tables: FlattenedReportContent["tables"] = [];

  for (const [key, value] of Object.entries(content)) {
    if (key === "narrative" || key === "filters" || key === "reportKind") continue;

    if (isArrayOfObjects(value)) {
      tables.push({ name: toLabel(key), rows: value });
      continue;
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      // One level of object nesting is common (e.g. `severity: { label,
      // domains: [...] }`) — an array-of-objects found here is promoted to
      // its own table (same as a top-level one) instead of being flattened
      // into an unreadable JSON string inside a summary row; an
      // array-of-scalars (e.g. `aiSummary.recommendations`) becomes a
      // joined string instead of raw JSON too. Deeper nesting than this
      // still falls back to JSON.stringify (stringifyScalar) — rare enough
      // across the 13 report types not to need its own case yet.
      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (isArrayOfObjects(nestedValue)) {
          tables.push({
            name: `${toLabel(key)} — ${toLabel(nestedKey)}`,
            rows: nestedValue,
          });
          continue;
        }
        summaryRows.push({
          field: `${toLabel(key)} — ${toLabel(nestedKey)}`,
          value: stringifyScalar(nestedValue),
        });
      }
      continue;
    }

    summaryRows.push({ field: toLabel(key), value: stringifyScalar(value) });
  }

  return { narrative, summaryRows, tables };
}
