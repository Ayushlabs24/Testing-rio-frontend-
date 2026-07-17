"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authService } from "@/services/auth/auth.service";
import { consentService } from "@/services/consent/consent.service";

/**
 * Blocks the app until the current user has accepted the *currently active*
 * consent policy version — not merely "consented at some point." Checking
 * `consentedPolicyVersion` against the live active version (rather than
 * just `consentedAt` truthiness) is what forces a re-prompt for everyone,
 * including already-consented orgs, after a policy version bump. Self-signup
 * admins no longer auto-consent at signup, so they hit this same gate on
 * first login, same as anyone an admin invites via the Users page.
 */
export function ConsentGuard({ children }: { children: ReactNode }) {
  const { session, setSession } = useAuth();
  const t = useTranslations("app.consent");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    consentService
      .getActive()
      .then((policy) => setActiveVersion(policy.version))
      .catch(() => setActiveVersion(null));
  }, []);

  if (!session) return null;
  // Still resolving the active version — render nothing rather than
  // flashing the consent screen for an already-consented user.
  if (activeVersion === undefined) return null;
  if (
    session.user.consentedPolicyVersion &&
    session.user.consentedPolicyVersion === activeVersion
  ) {
    return <>{children}</>;
  }

  const handleAccept = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await authService.giveConsent();
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <Logo />

      <Card className="w-full max-w-md">
        <CardContent className="p-10">
          <div className="bg-primary/10 text-primary mb-6 flex size-12 items-center justify-center rounded-full">
            <ShieldCheck className="size-6" />
          </div>

          <h1 className="text-foreground text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground mt-2 text-xs">{t("description")}</p>

          <p className="text-muted-foreground border-border mt-6 border-t pt-6 text-xs leading-relaxed">
            {t("body")}
          </p>

          {error ? <p className="text-destructive mt-5 text-xs">{error}</p> : null}

          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="mt-8 h-11 w-full gap-2 text-sm"
          >
            {isSubmitting ? t("accepting") : t("accept")}
            {!isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
