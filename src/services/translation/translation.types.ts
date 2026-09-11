/** Mirrors the backend's TranslateContentResult exactly. */
export interface TranslateContentResult {
  translatedText: string;
  sourceLocale: "en" | "ar";
  targetLocale: "en" | "ar";
  /** True when the backend returned the text unchanged (already in the
   * target language, or nothing translatable) without calling the AI
   * provider at all. */
  unchanged: boolean;
}
