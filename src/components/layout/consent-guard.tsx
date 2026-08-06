"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { authService } from "@/services/auth/auth.service";
import { consentService } from "@/services/consent/consent.service";

// Consent is given on behalf of the whole organisation, so only its owner
// is asked for it. Everyone else an admin adds via the Users page is
// covered by that acceptance and never sees this gate.
const CONSENTING_ROLE_KEY = "ngo_admin";

// Displayed consent copy version — tracks the legal text in messages/*.json,
// independent of the backend's ActiveConsentPolicy.version (an opaque
// gating key used only to detect "policy changed, re-prompt").
const CONSENT_COPY_VERSION = "1.0";

/**
 * Blocks the NGO Admin until they have accepted the *currently active*
 * consent policy version — not merely "consented at some point." Checking
 * `consentedPolicyVersion` against the live active version (rather than
 * just `consentedAt` truthiness) is what forces a re-prompt after a policy
 * version bump, even for an admin who already consented under an older one.
 *
 * Non-admin members pass straight through: the admin consents for the org,
 * so prompting an invited Field Researcher would be asking them to agree to
 * something that isn't theirs to agree to.
 */
export function ConsentGuard({ children }: { children: ReactNode }) {
  const { session, setSession } = useAuth();
  const t = useTranslations("app.consent");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null | undefined>(
    undefined,
  );

  const isConsentingRole = session?.role.key === CONSENTING_ROLE_KEY;

  useEffect(() => {
    // Nobody but the NGO Admin can be prompted, so don't even ask for the
    // active version on their behalf.
    if (!isConsentingRole) return;
    consentService
      .getActive()
      .then((policy) => setActiveVersion(policy.version))
      .catch(() => setActiveVersion(null));
  }, [isConsentingRole]);

  if (!session) return null;
  if (!isConsentingRole) return <>{children}</>;
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
    // The checkbox is the consent record, so an unchecked box is a
    // validation failure to surface — not a disabled button that leaves
    // the user guessing why nothing happens.
    if (!agreed) {
      setError(t("mustAgree"));
      return;
    }
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

  const organizationName = session.organization.name;

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="fixed end-4 top-4 flex items-center gap-1 sm:end-6 sm:top-6">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <Logo />

      <Card className="w-full max-w-2xl">
        <CardContent className="p-10">
          <div className="bg-primary/10 text-primary mb-6 flex size-12 items-center justify-center rounded-full">
            <ShieldCheck className="size-6" />
          </div>

          <h1 className="text-foreground text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("versionLine", {
              version: CONSENT_COPY_VERSION,
              effectiveDate: t("effectiveDatePlaceholder"),
            })}
          </p>

          <p className="text-muted-foreground border-border mt-6 border-t pt-6 text-xs leading-relaxed">
            {t("description", { organization: organizationName })}
          </p>

          <ul className="text-muted-foreground mt-3 space-y-3 text-xs leading-relaxed">
            <li>{t("bodyParagraph1")}</li>
            <li>{t("bodyParagraph2")}</li>
            <li>{t("bodyParagraph3")}</li>
            <li>{t("bodyParagraph4")}</li>
            <li>
              {t("bodyParagraph5", { contactChannel: t("contactChannelPlaceholder") })}
            </li>
          </ul>

          <div className="mt-6 flex items-start gap-3">
            <Checkbox
              id="consentAgree"
              checked={agreed}
              aria-invalid={Boolean(error) && !agreed}
              onCheckedChange={(checked) => {
                setAgreed(checked === true);
                if (checked === true) setError(null);
              }}
              className="mt-0.5"
            />
            <Label
              htmlFor="consentAgree"
              className="text-muted-foreground text-xs leading-relaxed font-normal"
            >
              {t("agreeLabel", { version: CONSENT_COPY_VERSION })}
            </Label>
          </div>

          {error ? <p className="text-destructive mt-5 text-xs">{error}</p> : null}

          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="mt-8 h-11 w-full gap-2 text-sm"
          >
            {isSubmitting ? t("accepting") : t("accept")}
            {!isSubmitting && <ArrowRight className="size-4 rtl:rotate-180" />}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
