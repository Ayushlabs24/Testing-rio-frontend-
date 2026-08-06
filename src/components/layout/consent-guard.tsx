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
import { authService } from "@/services/auth/auth.service";
import { consentService } from "@/services/consent/consent.service";
import type { ActiveConsentPolicies } from "@/services/consent/consent.types";

// Consent is given on behalf of the whole organisation, so only its owner
// is asked for it. Everyone else an admin adds via the Users page is
// covered by that acceptance and never sees this gate.
const CONSENTING_ROLE_KEY = "ngo_admin";

/**
 * Blocks the NGO Admin until they have accepted the *currently active*
 * version of BOTH consents — not merely "consented at some point." Checking
 * each accepted version against the live active version (rather than just
 * the timestamp's truthiness) is what forces a re-prompt after a policy
 * version bump, even for an admin who already consented under an older one.
 *
 * RIO-DATA-001 moved consent collection into registration itself, so a
 * freshly registered org arrives here already current on both and passes
 * straight through. This gate now exists for the two cases registration
 * can't cover:
 *   - accounts created before that change, which have no data-sharing
 *     consent on record at all, and
 *   - a policy version bump on either consent, which invalidates the
 *     existing acceptance of that one.
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
  const [sharingAgreed, setSharingAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // undefined = still loading, null = could not be resolved.
  const [policies, setPolicies] = useState<ActiveConsentPolicies | null | undefined>(
    undefined,
  );

  const isConsentingRole = session?.role.key === CONSENTING_ROLE_KEY;

  useEffect(() => {
    // Nobody but the NGO Admin can be prompted, so don't even ask for the
    // active versions on their behalf.
    if (!isConsentingRole) return;
    consentService
      .getActive()
      .then(setPolicies)
      .catch(() => setPolicies(null));
  }, [isConsentingRole]);

  if (!session) return null;
  if (!isConsentingRole) return <>{children}</>;
  // Still resolving the active versions — render nothing rather than
  // flashing the consent screen for an already-consented user.
  if (policies === undefined) return null;
  // Both must be current. An admin who accepted the use policy at
  // registration but predates the data-sharing consent is stopped here on
  // the sharing half alone — which is the whole reason the two versions are
  // tracked as separate pairs.
  const usePolicyCurrent =
    Boolean(session.user.consentedPolicyVersion) &&
    session.user.consentedPolicyVersion === policies?.usePolicy.version;
  const dataSharingCurrent =
    Boolean(session.user.sharingConsentedPolicyVersion) &&
    session.user.sharingConsentedPolicyVersion === policies?.dataSharing.version;
  if (usePolicyCurrent && dataSharingCurrent) {
    return <>{children}</>;
  }

  const handleAccept = async () => {
    setError(null);
    // The checkboxes are the consent record, so an unchecked box is a
    // validation failure to surface — not a disabled button that leaves
    // the user guessing why nothing happens. Both are required; POST
    // /auth/consent accepts them together.
    if (!agreed || !sharingAgreed) {
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

          {/* Each consent shows its own live policy text — falling back to
              the static copy only if the policies could not be loaded, so
              the gate still explains itself rather than showing a bare
              checkbox. */}
          <div className="border-border mt-6 space-y-5 border-t pt-6">
            <div className="space-y-2">
              <p className="text-muted-foreground max-h-32 overflow-y-auto text-xs leading-relaxed">
                {policies?.usePolicy.text ?? t("body")}
              </p>
              <div className="flex items-start gap-3">
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
                  {t("agreeLabel")}
                </Label>
              </div>
            </div>

            {/* RIO-DATA-001's second, separately-versioned consent. */}
            <div className="space-y-2">
              <p className="text-muted-foreground max-h-32 overflow-y-auto text-xs leading-relaxed">
                {policies?.dataSharing.text ?? t("sharingBody")}
              </p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consentSharingAgree"
                  checked={sharingAgreed}
                  aria-invalid={Boolean(error) && !sharingAgreed}
                  onCheckedChange={(checked) => {
                    setSharingAgreed(checked === true);
                    if (checked === true) setError(null);
                  }}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="consentSharingAgree"
                  className="text-muted-foreground text-xs leading-relaxed font-normal"
                >
                  {t("sharingAgreeLabel")}
                </Label>
              </div>
            </div>
          </div>

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
