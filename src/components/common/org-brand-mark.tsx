import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface OrgBrandMarkProps {
  /** The signed-in org's own uploaded logo (Settings > Organization), or null if it hasn't uploaded one. */
  logoUrl: string | null;
  /** Cross-entity roles (System Admin, Center Supervisor) aren't scoped to a single org. */
  crossEntity: boolean;
  collapsed?: boolean;
  className?: string;
}

export function NcnpEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="118 8 52 75"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#36b8a0"
        d="M139.1,37.62h0l-15.79-11.39c-.87-.62-2.06-.55-2.84.23-.85.85-.85,2.24,0,3.09l10.7,10.61-11.03,9.13c-.83.66-1.05,1.85-.5,2.79.62,1.05,1.95,1.4,3,.8l16.16-9.38c.41-.23.78-.57,1.08-.98,1.15-1.58.8-3.75-.78-4.9"
      />
      <path
        fill="#164f61"
        className="dark:fill-[#36b8a0]"
        d="M164.4,53.16l-16.3-9.61c-.57-.34-1.24-.53-1.97-.48-1.95.09-3.07,1.3-3.07,3.39,0,7.16.02,21.34.02,28.64,0,1.1.92,2.01,2.04,2.08,1.21.07,2.25-.85,2.34-2.04l2.22-23.01,12.79,4.96c.99.39,2.13,0,2.68-.94.64-1.03.3-2.38-.76-3"
      />
      <path
        fill="#3c7fcc"
        d="M166.26,26.94c-.32-1.17-1.54-1.85-2.7-1.53l-13.96,3.84-2.13-16.22c-.18-1.05-1.1-1.85-2.2-1.83-1.21.02-2.18,1.01-2.15,2.22.05,5.22,0,15.65,0,20.86,0,2.84,2.89,3.96,4.65,3.16l17.31-7.94c.96-.43,1.49-1.51,1.19-2.56"
      />
    </svg>
  );
}

/**
 * The org's own branding, wherever the app shows "which workspace am I in"
 * (sidebar header, topbar, mobile nav). Cross-entity roles (System Admin,
 * Center Supervisor) display the official NCNP brand mark emblem and text.
 */
export function OrgBrandMark({
  logoUrl,
  crossEntity,
  collapsed = false,
  className,
}: OrgBrandMarkProps) {
  const t = useTranslations("common");
  if (crossEntity) {
    if (collapsed) {
      return (
        <span
          className={cn("inline-flex shrink-0 items-center justify-center", className)}
        >
          <NcnpEmblem className="h-8 w-auto shrink-0" />
        </span>
      );
    }

    return (
      <div className={cn("flex shrink-0 items-center gap-3", className)}>
        <NcnpEmblem className="h-10 w-auto shrink-0" />
        <div className="flex flex-col justify-center leading-none">
          <span className="text-foreground text-lg font-extrabold tracking-tight">
            NCNP
          </span>
          <span className="text-muted-foreground mt-0.5 text-xs font-medium tracking-normal">
            {t("nationalCenter")}
          </span>
        </div>
      </div>
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
