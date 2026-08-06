import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { formatDate, formatDateTime } from "@/lib/format-date";

/**
 * Renders a date/time in the current locale's Gregorian format (spelled-out
 * month name, Latin digits). `dir="auto"` lets the browser resolve direction
 * from the string's own first strong character — RTL for the Arabic month
 * name, LTR for English — rather than inheriting the page's direction,
 * which would otherwise visually reorder the punctuation-separated segments.
 */
export function FormattedDate({
  value,
  withTime = false,
  className,
}: {
  value: string | Date;
  withTime?: boolean;
  className?: string;
}) {
  const locale = useLocale() as AppLocale;
  const text = withTime ? formatDateTime(value, locale) : formatDate(value, locale);
  return (
    <span dir="auto" className={className}>
      {text}
    </span>
  );
}
