import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /**
   * "inverted" is for use on a fixed-dark/colored surface — e.g. the
   * brand gradient panel — that doesn't itself flip with light/dark mode.
   */
  variant?: "default" | "inverted";
}

export function Logo({ className, variant = "default" }: LogoProps) {
  const isInverted = variant === "inverted";

  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 text-lg font-semibold tracking-tight",
        isInverted ? "text-on-brand-foreground" : "text-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold",
          isInverted
            ? "bg-on-brand-foreground text-on-brand-chip-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {siteConfig.name.charAt(0)}
      </span>
      {siteConfig.name}
    </Link>
  );
}
