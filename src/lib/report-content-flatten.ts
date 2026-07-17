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

function stringifyScalar(value: unknown): string {
  if (value === null || value === undefined) return "—";
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
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object" &&
      value[0] !== null
    ) {
      tables.push({ name: toLabel(key), rows: value as Array<Record<string, unknown>> });
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
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
