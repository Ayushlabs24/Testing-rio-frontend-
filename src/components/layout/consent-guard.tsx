"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authService } from "@/services/auth/auth.service";

/**
 * Blocks the app until the current user has personally accepted the
 * data-sharing consent notice. Self-signups consent during signup; anyone
 * an admin invited via the Users page hits this on first login, since
 * consent has to come from the person themselves, not whoever created
 * their account.
 */
export function ConsentGuard({ children }: { children: ReactNode }) {
  const { session, setSession } = useAuth();
  const t = useTranslations("app.consent");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;
  if (session.user.consentedAt) return <>{children}</>;

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
