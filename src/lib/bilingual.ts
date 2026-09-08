import type { AppLocale } from "@/i18n/routing";

/**
 * RIO Arabic Localization — Approach 3 (Hybrid, client-confirmed
 * 2026-09-04). Configurable/master data (Study Type, Target Sector, Need
 * Theme, Decision Type, Gap Type, Domain, Sub-domain, Question Bank) stores
 * an English value and an optional Arabic value side by side rather than
 * translating on the fly — see arabic-localization-approach.md. This is the
 * one display rule every one of those fields shares: show the Arabic value
 * when the app is in Arabic AND one has actually been supplied; fall back
 * to English otherwise (a newly-added value with no Arabic text yet, or any
 * screen rendered in English).
 */
export function localizedName(
  entity: { name: string; nameAr?: string | null },
  locale: AppLocale,
): string {
  if (locale === "ar" && entity.nameAr) return entity.nameAr;
  return entity.name;
}

/** Same rule as `localizedName`, for a field that isn't literally called
 * `name`/`nameAr` (e.g. Question.questionText/questionTextAr). */
export function localizedText(
  english: string,
  arabic: string | null | undefined,
  locale: AppLocale,
): string {
  if (locale === "ar" && arabic) return arabic;
  return english;
}
