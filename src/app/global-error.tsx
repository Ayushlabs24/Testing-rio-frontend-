"use client";

import { useEffect, useState } from "react";

/**
 * Root-level fallback (Next.js App Router convention) — triggers only when
 * an error escapes even the scoped `(app)/error.tsx` boundary (e.g. an error
 * in the root layout/providers themselves). Must render its own <html>/
 * <body> since it replaces the entire tree, and deliberately avoids any
 * app context (next-intl, auth, theme) that might itself be the source of
 * the failure — plain markup only, so this can never fail to render.
 *
 * next-intl is off-limits here, so the two strings are inlined and the
 * language is read from the URL's own locale prefix (`/ar/...`); anything
 * else — including the unprefixed default — is treated as English.
 */
const COPY = {
  en: {
    title: "Something went wrong",
    body: "An unexpected error occurred. Please try again.",
    retry: "Try again",
  },
  ar: {
    title: "حدث خطأ ما",
    body: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
    retry: "حاول مرة أخرى",
  },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Read once from the URL's locale prefix. The lazy initializer runs on the
  // server too (no `window`, so "en"); the client re-resolves it on mount —
  // acceptable for an error screen that already replaces the whole tree.
  const [lang] = useState<"en" | "ar">(() =>
    typeof window !== "undefined" && window.location.pathname.split("/")[1] === "ar"
      ? "ar"
      : "en",
  );
  useEffect(() => {
    console.error(error);
  }, [error]);

  const t = COPY[lang];

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "24rem", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            {t.title}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a3a3a3", marginBottom: "1.5rem" }}>
            {t.body}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              background: "#f5f5f5",
              color: "#0a0a0a",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
