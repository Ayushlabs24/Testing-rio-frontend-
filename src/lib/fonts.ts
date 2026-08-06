import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";

export const fontSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Geist has no Arabic glyphs, so Arabic text silently falls back to
 * whatever generic system font the OS picks — which doesn't reliably
 * support every weight (bold links were rendering as regular weight).
 * Loaded with the full weight range so `font-bold`/`font-semibold` etc.
 * render correctly for `ar`.
 */
export const fontArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
});
