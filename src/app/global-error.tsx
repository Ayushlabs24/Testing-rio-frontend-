"use client";

import { useEffect } from "react";

/**
 * Root-level fallback (Next.js App Router convention) — triggers only when
 * an error escapes even the scoped `(app)/error.tsx` boundary (e.g. an error
 * in the root layout/providers themselves). Must render its own <html>/
 * <body> since it replaces the entire tree, and deliberately avoids any
 * app context (next-intl, auth, theme) that might itself be the source of
 * the failure — plain markup only, so this can never fail to render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
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
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#a3a3a3", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try again.
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
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
