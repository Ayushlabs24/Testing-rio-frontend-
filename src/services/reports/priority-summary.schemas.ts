import { z } from "zod";

/**
 * `PrioritySummaryResponse.snapshot`/`previewSnapshot()`'s return are both a
 * loose `Record<string, unknown>` — the blob's real shape varies by scope
 * and backend version. This schema only covers the fields the UI actually
 * reads (`AiPrioritySummaryPanel`'s evidence count,
 * `GenerateSummaryModal`'s preview fields); everything is optional so an
 * absent field is not itself a validation failure, but a field present with
 * the wrong type now fails loudly via `safeParse` instead of silently
 * flowing through as `unknown`. `z.infer` derives the type from the schema
 * so the two can never drift apart.
 */
export const prioritySummarySnapshotSchema = z.object({
  scope: z.string().optional(),
  evidence: z.array(z.unknown()).optional(),
  responseQuality: z
    .object({
      submittedResponseCount: z.number().optional(),
      validResponseCount: z.number().optional(),
      confidenceLevel: z.string().optional(),
    })
    .optional(),
  severity: z
    .object({
      overallVillageNeedsIndex: z.number().nullable().optional(),
    })
    .optional(),
});

export type PrioritySummarySnapshot = z.infer<typeof prioritySummarySnapshotSchema>;

/**
 * Parses an untrusted snapshot blob, falling back to `null` on a shape
 * mismatch — the same "treat as absent" behavior these panels already use
 * for a missing/failed snapshot, just now applied to a malformed one too.
 */
export function parsePrioritySummarySnapshot(
  raw: unknown,
): PrioritySummarySnapshot | null {
  const result = prioritySummarySnapshotSchema.safeParse(raw);
  return result.success ? result.data : null;
}
