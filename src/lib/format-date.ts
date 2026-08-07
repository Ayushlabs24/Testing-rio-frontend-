import type { AppLocale } from "@/i18n/routing";

function intlLocale(locale: AppLocale): string {
  return locale === "ar" ? "ar-SA" : "en-US";
}

// Gregorian calendar + Latin digits regardless of UI language — Arabic-Indic
// digits weren't requested, and Saudi software commonly sticks to Western
// digits (see RTL review feedback), so ar-SA must not default to them.
const FIXED_OPTS: Intl.DateTimeFormatOptions = {
  calendar: "gregory",
  numberingSystem: "latn",
};

const DATE_PART_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const TIME_PART_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

// Built from separate date/time parts (not `dateStyle`/`timeStyle`) on
// purpose: ar-SA's built-in "medium" dateStyle renders day/month/year as
// slash-separated numerals (e.g. "05‏/08‏/2026"), not a spelled-out month —
// this keeps both languages in the same "5 August 2026" shape, only the
// month name and list separator actually translate.
const SEPARATOR: Record<AppLocale, string> = {
  en: ", ",
  ar: "، ",
};

/**
 * Every date/time rendered in the UI must go through this — passing
 * `undefined` to `Intl.DateTimeFormat` (the old per-file pattern) resolves
 * to the *browser's* locale, not the app's, so Arabic pages kept rendering
 * English-formatted dates.
 */
export function formatDate(value: string | Date, locale: AppLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...DATE_PART_OPTS,
    ...FIXED_OPTS,
  }).format(date);
}

export function formatDateTime(value: string | Date, locale: AppLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const datePart = new Intl.DateTimeFormat(intlLocale(locale), {
    ...DATE_PART_OPTS,
    ...FIXED_OPTS,
  }).format(date);
  const timePart = new Intl.DateTimeFormat(intlLocale(locale), {
    ...TIME_PART_OPTS,
    ...FIXED_OPTS,
  }).format(date);
  return `${datePart}${SEPARATOR[locale]}${timePart}`;
}
