"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`, resetting the timer on every change. For
 * search boxes that drive a network request: the input stays fully
 * responsive while only the settled value reaches the server.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
