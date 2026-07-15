import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /**
   * "default" auto-switches between the colored and white marks with the
   * app's light/dark theme. "inverted" always renders the white mark
   * regardless of theme — for a fixed-dark/colored surface (e.g. the brand
   * gradient panel) that doesn't itself flip with light/dark mode.
   */
  variant?: "default" | "inverted";
  /** "lg" is for large, brand-forward surfaces (e.g. the auth hero panel). */
  size?: "default" | "lg";
}

// NCNP-logo-white.svg is derived (recolored) from NCNP-logo-color.svg, not
// separately supplied brand artwork — swap it for an official white/inverted
// export if one becomes available (see public/brand/).
const COLOR_SRC = "/brand/ncnp-logo-color.svg";
const WHITE_SRC = "/brand/ncnp-logo-white.svg";

const LOGO_HEIGHT = {
  default: "h-10",
  lg: "h-16",
} as const;

export function Logo({ className, variant = "default", size = "default" }: LogoProps) {
  const heightClass = LOGO_HEIGHT[size];

  return (
    <Link href="/" className={cn("flex items-center", className)}>
      {variant === "inverted" ? (
        // eslint-disable-next-line @next/next/no-img-element -- static brand asset, no next/image benefit here
        <img
          src={WHITE_SRC}
          alt={siteConfig.name}
          className={cn("w-auto", heightClass)}
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no next/image benefit here */}
          <img
            src={COLOR_SRC}
            alt={siteConfig.name}
            className={cn("w-auto dark:hidden", heightClass)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no next/image benefit here */}
          <img
            src={WHITE_SRC}
            alt={siteConfig.name}
            className={cn("hidden w-auto dark:block", heightClass)}
          />
        </>
      )}
    </Link>
  );
}
