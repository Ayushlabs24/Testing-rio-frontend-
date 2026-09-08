"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { translationService } from "@/services/translation/translation.service";

// Same script ranges as the backend's TranslationService.detectLocale —
// kept in sync deliberately (see that file's comment) so the client and
// server agree on what "already in Arabic" means before ever making a
// request. Written as \u{...} escapes, never pasted Arabic characters, for
// the same encoding-safety reason as the backend copy.
const ARABIC_SCRIPT_RE =
  /[\u{0600}-\u{06FF}\u{0750}-\u{077F}\u{08A0}-\u{08FF}\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}]/u;
// At least one letter in either script — a string with no letters at all
// (a number, a code, punctuation) has no language to translate, so it must
// never be treated as "needs translation" just because it contains no
// Arabic script.
const HAS_LETTERS_RE =
  /[\u{0600}-\u{06FF}\u{0750}-\u{077F}\u{08A0}-\u{08FF}\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}A-Za-z]/u;

// Whether `text` still has content in the OPPOSITE script from
// `targetLocale` — not the same question as detectLocale's "which script
// dominates". A backend-generated string that concatenates a fixed English
// template with a dynamic value that already happens to be Arabic (e.g. a
// report title, "Individual Survey Report — Survey: <Arabic need name>")
// is majority-Arabic by character count, so detectLocale calls it "ar" —
// but the English template portion is still untranslated. Comparing
// `detectLocale(text) !== locale` treated that whole string as "already
// matches", permanently skipping it. Checking for the opposite script
// directly catches a genuinely mixed-script string in both directions.
// Kept in sync with the backend TranslationService's own copy.
function needsTranslationTo(text: string, targetLocale: AppLocale): boolean {
  if (!HAS_LETTERS_RE.test(text)) return false;
  return targetLocale === "ar" ? /[A-Za-z]/.test(text) : ARABIC_SCRIPT_RE.test(text);
}

// Session-lifetime memo, shared across every component instance in this
// tab — so the same Need title shown in a table row AND a detail panel
// only ever triggers one request between them. The backend's
// TranslationCache is the permanent, cross-session version of this; this
// is just the in-tab layer on top of it.
const memoCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function cacheKey(text: string, targetLocale: AppLocale): string {
  return `${targetLocale}:${text}`;
}

function fetchTranslation(
  text: string,
  targetLocale: AppLocale,
  key: string,
): Promise<string> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = translationService
    .translate(text, targetLocale)
    .then((result) => {
      memoCache.set(key, result.translatedText);
      return result.translatedText;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export interface AutoTranslateResult {
  /** What to render right now: the original text while no translation is
   * needed or one is still in flight, the translated text once resolved. */
  text: string;
  isTranslating: boolean;
}

/**
 * Live-translates one piece of user-typed free text into the current UI
 * locale, when (and only when) the text's own script doesn't already match
 * that locale — the dynamic-content half of the hybrid Arabic localization
 * approach (client-confirmed 2026-09-08: every user-typed free-text field,
 * app-wide). Fixed master data with its own name/nameAr columns should keep
 * using `localizedName`/`localizedText` from @/lib/bilingual instead — this
 * hook is only for content nobody pre-translated.
 *
 * What this is for vs. what it is deliberately NOT for (2026-09-08 review):
 *  - Need/Study/Initiative/Report titles, statements, notes, purposes — yes,
 *    this is exactly the content that needed it, wired in across the app.
 *  - AI-generated content (classification rationale, Need summaries) — yes,
 *    same treatment as human-typed text, since it's just as language-specific.
 *  - Organization names and person (user) names — YES, per an explicit
 *    client reversal (2026-09-08): Ganesh's directive is that everything
 *    must read in Arabic when Arabic is selected, no exceptions, so these
 *    now go through this hook too, wired in across Settings, System Admin,
 *    the sidebar brand mark, sharing panels, and the audit log. This
 *    supersedes an earlier, more conservative default that treated a
 *    proper identifier as never-translatable — worth remembering if a
 *    caller elsewhere still special-cases these; there is no other stored
 *    "official Arabic name" field for either, this hook's on-demand
 *    translation is the only mechanism.
 *  - Email addresses, IDs/codes, URLs — still NEVER. These aren't prose in
 *    either language; translating them would corrupt the value itself.
 *  - An editable field where the saved value IS the reviewed/approved
 *    content (e.g. the Need-summary review textarea) — translating what's
 *    on screen there would risk a translated-but-unreviewed sentence being
 *    saved as if it were the human's own edit. Read-only reference text next
 *    to such a field is still fair game.
 *
 * Best-effort: a failed translation just keeps showing the original text
 * (same philosophy as the backend service), never an error state.
 */
export function useAutoTranslate(text: string | null | undefined): AutoTranslateResult {
  const locale = useLocale() as AppLocale;
  const original = text ?? "";
  const needsTranslation = needsTranslationTo(original, locale);
  const key = needsTranslation ? cacheKey(original, locale) : null;

  // Only ever written from the async fetch's own then/catch callback — never
  // synchronously in the effect body (react-hooks/set-state-in-effect
  // rightly flags that as a cascading-render risk). The synchronous cases —
  // no key needed, or already in memoCache — are derived directly below
  // instead of mirrored into state; `fetched` exists purely to trigger a
  // re-render once a genuinely async fetch settles (success is re-read from
  // memoCache itself; `text` here also covers the on-failure fallback, which
  // deliberately does NOT get cached, so retries are possible later).
  const [fetched, setFetched] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (!key || memoCache.has(key)) return;
    let cancelled = false;
    fetchTranslation(original, locale, key)
      .then((translatedText) => {
        if (!cancelled) setFetched({ key, text: translatedText });
      })
      .catch(() => {
        // Falls back to the original text on failure, so the caller reads
        // this as settled rather than "still in flight forever".
        if (!cancelled) setFetched({ key, text: original });
      });
    return () => {
      cancelled = true;
    };
  }, [key, original, locale]);

  if (!needsTranslation || !key) return { text: original, isTranslating: false };
  const cached = memoCache.get(key);
  if (cached !== undefined) return { text: cached, isTranslating: false };
  if (fetched?.key === key) return { text: fetched.text, isTranslating: false };
  return { text: original, isTranslating: true };
}
