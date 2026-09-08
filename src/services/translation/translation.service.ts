import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { TranslateContentResult } from "@/services/translation/translation.types";

/**
 * RIO Arabic Localization — Approach 3 (Hybrid, client-confirmed
 * 2026-09-08). The dynamic-content half of the hybrid approach: everything
 * user-typed (Need title/statement, evidence descriptions, decision notes,
 * sharing purposes, initiative descriptions, ...) goes through this one
 * endpoint on demand, rather than the side-by-side name/nameAr columns used
 * for fixed master data (see @/lib/bilingual for that, separate, rule).
 *
 * The backend caches every result permanently (TranslationCache), so this
 * only ever calls the AI provider the first time a given piece of text is
 * seen in a given direction — use-auto-translate.ts adds a client-side
 * memo on top so the same string isn't even re-requested twice in one
 * session.
 */
export const translationService = {
  async translate(
    text: string,
    targetLocale: "en" | "ar",
    sourceLocale?: "en" | "ar",
  ): Promise<TranslateContentResult> {
    return apiClient.post<TranslateContentResult>(endpoints.translation.translate, {
      text,
      targetLocale,
      sourceLocale,
    });
  },
};
