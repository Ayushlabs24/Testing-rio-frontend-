import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import { Direction } from "radix-ui";
import { AuthProvider } from "@/components/providers/auth-provider";
import { IntlProvider } from "@/components/providers/intl-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

interface AppProvidersProps {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
  children: ReactNode;
}

/**
 * Single composition root for every app-wide provider (theming, i18n, auth
 * session, and anything added later such as a query client). The root
 * layout only ever needs to render this once.
 */
export function AppProviders({
  locale,
  messages,
  timeZone,
  children,
}: AppProvidersProps) {
  return (
    <ThemeProvider>
      <IntlProvider locale={locale} messages={messages} timeZone={timeZone}>
        {/* Radix primitives (Select, DropdownMenu, Tabs, ...) default to LTR
            internally and don't just inherit the page's `dir` — without this,
            they stamp `dir="ltr"` straight onto their own DOM nodes even on
            Arabic pages. This is the one place that needs to know the
            locale's direction; every Radix component under here picks it up
            automatically via context, no per-component prop needed. */}
        <Direction.Provider dir={locale === "ar" ? "rtl" : "ltr"}>
          <AuthProvider>{children}</AuthProvider>
        </Direction.Provider>
      </IntlProvider>
    </ThemeProvider>
  );
}
