import { defineRouting } from "next-intl/routing";

/**
 * Central place to add/remove supported locales.
 * Adding a new language only requires: 1) a new entry here,
 * 2) a new `messages/<locale>.json` file.
 */
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
