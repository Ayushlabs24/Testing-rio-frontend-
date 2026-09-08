"use client";

import { useAutoTranslate } from "@/hooks/use-auto-translate";

/**
 * Drop-in replacement for rendering a piece of user-typed free text (a Need
 * title/statement, an evidence description, a decision note, a sharing
 * purpose, ...) anywhere it needs to follow the current UI locale — see
 * useAutoTranslate for the full reasoning. Renders the original text
 * immediately and swaps to the translation once it resolves, so there's
 * never a blank/loading state, only a brief moment showing the source
 * language while an uncached string is translated for the first time.
 *
 * `dir="auto"` matches FormattedDate's approach: let the browser resolve
 * text direction from the rendered string's own script rather than
 * inheriting the page's direction, since a translated string's script can
 * differ from the page it's embedded in for a moment.
 *
 * Not for master data that already has its own name/nameAr columns
 * (Study Type, Domain, Question Bank, ...) — use `localizedName`/
 * `localizedText` from @/lib/bilingual for those instead.
 */
export function AutoTranslate({
  text,
  as: Tag = "span",
  className,
}: {
  text: string | null | undefined;
  as?: "span" | "p" | "div";
  className?: string;
}) {
  const { text: displayText } = useAutoTranslate(text);
  return (
    <Tag dir="auto" className={className}>
      {displayText}
    </Tag>
  );
}
