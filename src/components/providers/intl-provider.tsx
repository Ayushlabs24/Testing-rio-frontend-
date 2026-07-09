"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

interface IntlProviderProps {
  locale: string;
  messages: AbstractIntlMessages;
  timeZone: string;
  children: ReactNode;
}

/**
 * Client-side i18n provider. Receives `locale`/`messages`/`timeZone` resolved
 * on the server (see `app/[locale]/layout.tsx`) and makes translations
 * available to client components via `useTranslations`.
 */
export function IntlProvider({
  locale,
  messages,
  timeZone,
  children,
}: IntlProviderProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
