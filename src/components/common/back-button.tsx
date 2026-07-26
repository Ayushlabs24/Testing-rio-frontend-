"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

/** Standard "back to X" navigation — rendered on its own left-aligned line
 * above the PageHeader (never inside `actions`, which stays right-aligned
 * for the page's own primary buttons), so it doesn't compete with the title/
 * description for attention.
 *
 * `href`/`label` name the fallback destination (e.g. a list page), but the
 * actual click prefers real browser history when the user arrived via an
 * in-app link — so "Back" returns to wherever they actually came from (a
 * Need's workspace page, a Study, Survey Builder's own list, ...) instead of
 * always landing on one fixed page regardless of entry point. That check
 * happens inside the click handler itself (not stored as render state) so
 * this always renders the same markup on server and client — no hydration
 * mismatch, no setState-in-effect.
 */
export function BackButton({ href, label }: { href: string; label: string }) {
  const router = useRouter();

  function handleClick() {
    let cameFromInApp = false;
    try {
      cameFromInApp = new URL(document.referrer).origin === window.location.origin;
    } catch {
      cameFromInApp = false;
    }
    // The `label` text (e.g. "Back to Survey Builder") stays static either
    // way — deciding it dynamically would need render-time state, which
    // would either mismatch server/client output or need a setState-in-
    // effect the lint rules flag. The actual navigation target is what
    // matters most here: real history when the user arrived via an in-app
    // link, so this returns to wherever they actually came from (a Need's
    // workspace page, a Study, ...) instead of always landing on one fixed
    // page regardless of entry point.
    if (cameFromInApp) {
      router.back();
      return;
    }
    router.push(href);
  }

  return (
    <Button type="button" variant="outline" className="gap-1.5" onClick={handleClick}>
      <ArrowLeft className="size-3.5" />
      {label}
    </Button>
  );
}
