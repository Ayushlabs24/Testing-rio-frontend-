import type { DomainSubDomainPair } from "@/services/ai-decisions/ai-decisions.types";

export interface PendingOverride {
  pairs: DomainSubDomainPair[];
  reason: string;
}

// The staged Override (pairs + reason) is never written to the Need until
// Approve — a browser refresh mid-override must never half-decide the Need.
// But it needs to survive two different round trips that would otherwise
// lose it entirely (each unmounts whichever component staged it):
//  - the Need workspace page's "View Suggested Questions" navigating to the
//    Survey Builder page and back;
//  - the Survey Builder page itself being the one that actually commits it
//    (via "Approve & Publish"), reading back whatever the Need workspace
//    page staged.
// sessionStorage is a pure client-side draft recovery mechanism — still just
// a draft, gone entirely on tab close, never treated as authoritative by
// either page or the backend.
function storageKey(needId: string): string {
  return `rio:pending-override:${needId}`;
}

export function readStoredPendingOverride(needId: string): PendingOverride | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(needId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { pairs?: unknown }).pairs) &&
      typeof (parsed as { reason?: unknown }).reason === "string"
    ) {
      return parsed as PendingOverride;
    }
  } catch {
    // Malformed/foreign sessionStorage value — treat as no staged override.
  }
  return null;
}

export function writeStoredPendingOverride(
  needId: string,
  value: PendingOverride | null,
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(needId);
  if (value) {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } else {
    window.sessionStorage.removeItem(key);
  }
}
