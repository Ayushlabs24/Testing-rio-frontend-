import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Standard "back to X" navigation — lives in a PageHeader's `actions` slot
 * (top-right), not as a standalone text line above the title. Default size
 * (no `size` override) so it matches whatever primary action button sits
 * next to it — every page's own primary button (Save, Create, Add Need...)
 * uses the Button default too, so mixing sizes here would look inconsistent. */
export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" className="gap-1.5">
      <Link href={href}>
        <ArrowLeft className="size-3.5" />
        {label}
      </Link>
    </Button>
  );
}
