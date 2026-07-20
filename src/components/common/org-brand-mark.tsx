import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgBrandMarkProps {
  /** The signed-in org's own uploaded logo (Settings > Organization), or null if it hasn't uploaded one. */
  logoUrl: string | null;
  /** Cross-entity roles (System Admin, Center Supervisor) aren't scoped to a single org. */
  crossEntity: boolean;
  className?: string;
}

/**
 * The org's own branding, wherever the app shows "which workspace am I in"
 * (sidebar header, topbar, mobile nav). Signup no longer collects a logo,
 * so most orgs have none — renders nothing at all in that case (just the
 * org name text next to it, from the caller) rather than falling back to a
 * generic placeholder mark that isn't actually the org's own branding.
 */
export function OrgBrandMark({ logoUrl, crossEntity, className }: OrgBrandMarkProps) {
  if (crossEntity) {
    return (
      <span
        className={cn(
          "bg-sidebar-accent text-sidebar-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md",
          className,
        )}
      >
        <ShieldCheck className="size-4" />
      </span>
    );
  }

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- org-supplied image, not a static asset
      <img
        src={logoUrl}
        alt=""
        className={cn("size-8 shrink-0 rounded-md object-cover", className)}
      />
    );
  }

  return null;
}
