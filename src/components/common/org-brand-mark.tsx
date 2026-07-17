import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/common/logo";
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
 * (sidebar header, topbar, mobile nav). Falls back to the Rio logo when the
 * org hasn't uploaded one yet — never a hardcoded image, always whatever
 * `session.organization.logoUrl` currently is, so it updates the moment the
 * org's logo changes (see Settings > Organization / signup).
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

  return <Logo className={cn("shrink-0", className)} />;
}
