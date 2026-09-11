import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content skeleton for any in-app route while it resolves — including the
 * language-switch transition, where the page re-renders in the new locale.
 * The app shell (sidebar/topbar) is supplied by `(app)/layout.tsx` and stays
 * put; this only stands in for the page body, so a switch never shows a
 * blank content area — the reader can see something is loading.
 */
export default function AppLoading() {
  return (
    <div
      className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      {/* page header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* stat row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      {/* main panel */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
