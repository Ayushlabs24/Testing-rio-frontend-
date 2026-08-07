import type { AppLocale } from "@/i18n/routing";

/**
 * A handful of fixed, non-AI-generated English strings the backend bakes
 * directly into report/dashboard payloads as display-ready prose (see
 * report-summary-data.provider.ts, report-content.types.ts) rather than
 * translation keys — so they render in English even inside an Arabic report.
 * Real AI-authored narrative (executive summaries, recommendations, etc.) is
 * free-form and out of scope here; this only covers the small set of
 * deterministic placeholder/template strings, matched by exact text.
 */
const KNOWN_STRINGS: Record<string, string> = {
  "Assessment trend": "اتجاه التقييم",
  "Trend pending — first assessment cycle.": "الاتجاه غير متاح بعد — هذه أول دورة تقييم.",
  "Trend pending — no assessment cycle has completed.":
    "الاتجاه غير متاح بعد — لم تكتمل أي دورة تقييم بعد.",
  "Trends cannot be assessed from a single assessment cycle.":
    "لا يمكن تقييم الاتجاهات استناداً إلى دورة تقييم واحدة فقط.",
};

export function localizeReportText(text: string, locale: AppLocale): string {
  if (locale !== "ar") return text;
  return KNOWN_STRINGS[text] ?? text;
}
