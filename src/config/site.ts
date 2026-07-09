import { env } from "@/config/env";

/**
 * Non-translatable, brand-level configuration.
 * User-facing copy (titles, descriptions) lives in the message files
 * under `messages/*.json`, not here.
 */
export const siteConfig = {
  name: "Rio",
  url: env.NEXT_PUBLIC_APP_URL,
  ogImage: `${env.NEXT_PUBLIC_APP_URL}/og.png`,
  links: {
    github: "https://github.com/",
  },
} as const;
