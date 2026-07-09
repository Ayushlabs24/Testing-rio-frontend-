import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/**
 * Locale-aware alternatives to `next/link` and `next/navigation`.
 * Always import `Link`, `redirect`, `usePathname`, `useRouter` from here
 * instead of directly from `next/*` so locale prefixes are handled automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
