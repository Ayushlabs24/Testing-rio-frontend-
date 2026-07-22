import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Standard "back to X" navigation — rendered on its own left-aligned line
 * above the PageHeader (never inside `actions`, which stays right-aligned
 * for the page's own primary buttons), so it doesn't compete with the title/
 * description for attention. */
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
