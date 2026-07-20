import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Up to two initials from a display name, for an avatar fallback — same
 * rule the sidebar/topbar profile avatars already use. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Turns a raw snake_case/kebab-case backend value (e.g. "manual_entry",
 * "long_text") into a human-readable label ("Manual Entry", "Long Text") —
 * the UI should never expose a raw DB value verbatim. */
export function titleCase(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
