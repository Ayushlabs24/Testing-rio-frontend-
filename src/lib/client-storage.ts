/**
 * Every key this app writes to `localStorage`/`sessionStorage` must start
 * with this prefix — the single thing that makes it safe to bulk-clear RIO
 * state on logout without ever touching anything else sharing the origin
 * (a browser extension, other dev tooling, or simply a future feature that
 * forgets to scope itself). A blanket `localStorage.clear()`/
 * `sessionStorage.clear()` has none of that protection — see auth-provider.tsx.
 */
export const RIO_STORAGE_PREFIX = "rio.";

export function isRioStorageKey(key: string): boolean {
  return key.startsWith(RIO_STORAGE_PREFIX);
}

/** Removes every RIO-owned key from one Storage object, leaving every other
 * key (however it got there) untouched. Collects keys before removing —
 * `storage.key(i)` is index-based and reshuffles as items are deleted, so
 * removing during iteration would skip entries. */
function clearRioKeysFrom(storage: Storage): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isRioStorageKey(key)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) storage.removeItem(key);
}

/**
 * Called on logout. Removes every RIO-owned key from both `localStorage`
 * and `sessionStorage` — never the origin-wide `.clear()` this replaces.
 *
 * `userId`, when given, is accepted for callers that want to be explicit
 * about whose state is being cleared (and to make a future genuinely
 * per-user-only key easy to add correctly) — today every existing
 * user-scoped key (`rio.reviewerSla.seenIds.<userId>`,
 * `rio.sharingAlerts.seenIds.<userId>`) already embeds the user id directly
 * in its own key name, so a *different* user logging in next can never read
 * a departing user's "seen" state regardless of whether logout clears
 * anything at all — this function's job is strictly about not leaking
 * unrelated origin storage, not about cross-user isolation (which the key
 * naming already guarantees).
 */
export function clearRioSessionStorage(userId?: string): void {
  void userId; // reserved for a future genuinely user-id-filtered key; see doc comment
  if (typeof window === "undefined") return;
  clearRioKeysFrom(window.localStorage);
  clearRioKeysFrom(window.sessionStorage);
}
