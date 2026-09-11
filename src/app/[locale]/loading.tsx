/**
 * Shown for the brief server round-trip when the locale segment itself
 * re-resolves — most visibly on a language switch, where the whole tree
 * re-renders in the new locale. A plain themed ground with a soft pulse so
 * the switch reads as "loading", never as a blank flash.
 */
export default function LocaleLoading() {
  return (
    <div
      className="bg-background flex min-h-screen items-center justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="bg-muted size-10 animate-pulse rounded-full" />
    </div>
  );
}
