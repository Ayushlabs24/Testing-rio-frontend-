/** KSA Geographic Reference — Region -> Governorate -> Center, seeded from
 * the official administrative hierarchy (see the backend's
 * prisma/import-geography.ts). Read-only reference data. */
export interface Region {
  id: string;
  code: number;
  name: string;
  // RIO Arabic Localization — Approach 3 (Hybrid, client-confirmed
  // 2026-09-04). The official Arabic name, from the client-supplied
  // KSA_Geographic_Reference_ENRICHED workbook — display falls back to
  // `name` (see localizedName() in @/lib/bilingual) on the rare row this
  // workbook doesn't cover.
  nameAr: string | null;
  isoCode: string;
  capital: string;
}

export interface Governorate {
  id: string;
  code: string;
  regionId: string;
  name: string;
  nameAr: string | null;
  category: string;
}

export interface Center {
  id: string;
  code: string;
  governorateId: string;
  name: string;
  nameAr: string | null;
  category: string;
}
