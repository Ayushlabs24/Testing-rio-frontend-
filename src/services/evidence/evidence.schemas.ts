import { z } from "zod";

/**
 * The real `Evidence` type (evidence.types.ts) only guarantees
 * id/fileName/fileType/uploadedAt today — no review/inclusion/domain-
 * linkage metadata exists on it yet. `SupportingEvidencePanel` reads the
 * fields below defensively regardless (every one defaults if absent), but
 * a field present with the wrong type — e.g. `isIncludedInReport` sent as
 * a string — used to flow through silently via an `as` cast. `safeParse`
 * catches that at runtime instead; every field stays optional so an
 * absent field is not itself a validation failure.
 */
const rawEvidenceItemSchema = z.object({
  id: z.string().optional(),
  fileName: z.string().optional(),
  title: z.string().optional(),
  fileType: z.string().optional(),
  sourceReferenceId: z.string().optional(),
  linkedDomainOrKpi: z.string().optional(),
  description: z.string().optional(),
  collectedAt: z.string().optional(),
  uploadedAt: z.string().optional(),
  reviewStatus: z.string().optional(),
  isIncludedInReport: z.boolean().optional(),
});

export type RawEvidenceItem = z.infer<typeof rawEvidenceItemSchema>;

/**
 * Parses an untrusted evidence list, dropping only the individual items
 * that don't match the shape above rather than discarding the whole list —
 * one malformed row from the backend shouldn't hide every other Need's
 * evidence from this panel.
 */
export function parseRawEvidenceList(raw: unknown): RawEvidenceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const result = rawEvidenceItemSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}
