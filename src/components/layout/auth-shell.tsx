import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/common/logo";
import { ContactDialog } from "@/components/features/auth/contact-dialog";
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
      <div className="bg-gradient-hero text-on-brand-foreground flex flex-col gap-2 px-6 pt-4 pb-6 sm:px-8 sm:pt-5 sm:pb-8 lg:hidden">
        <Logo variant="hero" size="lg" className="-ml-5" />
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {heroTitle}
        </h2>
      </div>

      <div className="bg-gradient-hero text-on-brand-foreground hidden flex-col justify-between px-8 pt-6 pb-8 lg:flex lg:px-10 lg:pt-8 lg:pb-10 xl:px-14 xl:pt-10 xl:pb-14">
        <Logo variant="hero" size="lg" className="-ml-5" />

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

      <div className="bg-auth-surface relative flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>
        {children}
      </div>

      {/* Rendered here rather than per-page so the enquiry form is reachable
          from every auth page — someone locked out needs it most when they
          cannot sign in. It positions itself as a fixed floating button. */}
      <ContactDialog />
    </div>
  );
}
