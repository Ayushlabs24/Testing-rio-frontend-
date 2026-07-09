import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface AuthShellProps {
  heroTitle: string;
  heroSubtitle?: string;
  heroBullets?: string[];
  children: ReactNode;
}

/**
 * Shared two-column shell for every public auth page (login, signup,
 * forgot/reset password, OTP): a brand gradient panel on the left (a
 * compact banner on small screens), the page's form on the right.
 */
export function AuthShell({
  heroTitle,
  heroSubtitle,
  heroBullets,
  children,
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Compact banner shown only below the lg breakpoint, in place of the full hero panel. */}
      <div className="bg-gradient-hero text-on-brand-foreground flex flex-col gap-2 p-6 sm:p-8 lg:hidden">
        <Logo variant="inverted" />
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {heroTitle}
        </h2>
      </div>

      <div className="bg-gradient-hero text-on-brand-foreground hidden flex-col justify-between p-8 lg:flex lg:p-10 xl:p-14">
        <Logo variant="inverted" />

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
            {heroTitle}
          </h2>
          {heroSubtitle ? (
            <p className="text-on-brand-foreground/80">{heroSubtitle}</p>
          ) : null}
          {heroBullets ? (
            <ul className="space-y-3">
              {heroBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  <span className="text-on-brand-foreground/90">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div />
      </div>

      <div className="bg-background relative flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </div>
  );
}
