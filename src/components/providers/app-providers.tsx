import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
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
        <AuthProvider>{children}</AuthProvider>
      </IntlProvider>
    </ThemeProvider>
  );
}
