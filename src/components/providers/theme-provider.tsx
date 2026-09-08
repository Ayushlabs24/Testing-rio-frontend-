"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";
import { useEffect } from "react";

// `next-themes` (unmaintained, no fix released) injects its anti-FOUC
// snippet as a literal <script> element in the React tree — needed once on
// the very first SSR render, but React 19 also warns about it every time
// this provider remounts afterward (e.g. our locale switch remounts the
// whole app/[locale] tree, since it's the root layout). The warning is
// purely cosmetic: the script was never meant to re-execute on a later
// render, dark/light mode keeps working correctly either way. Filtering
// only this one, exact, known message — see
// https://github.com/pacocoursey/next-themes/issues/387 — everything else
// still reaches the console untouched.
function useSuppressNextThemesScriptWarning() {
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("Encountered a script tag while rendering React component")
      ) {
        return;
      }
      originalError(...args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);
}

/**
 * Wraps `next-themes` with Rio's defaults (class-based dark mode driven by
 * the `.dark` selector used in `src/styles/tokens.css`, following the OS
 * preference unless the user picks a theme explicitly).
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  useSuppressNextThemesScriptWarning();

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
