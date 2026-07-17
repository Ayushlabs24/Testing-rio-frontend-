"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consentService } from "@/services/consent/consent.service";
import type { OrganizationConsentStatus } from "@/services/consent/consent.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/**
 * Read-only — Organization Settings' Consent card. Deliberately its own
 * small, self-contained component (not inlined into the settings page) so
 * it doesn't collide with other edits to that same page.
 */
export function OrganizationConsentCard() {
  const t = useTranslations("app.settings.organization.consent");
  const [status, setStatus] = useState<OrganizationConsentStatus | null>(null);

  useEffect(() => {
    consentService
      .getOrganizationStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === null ? (
          <div className="bg-muted h-16 animate-pulse rounded-md" />
        ) : status.version === null ? (
          <p className="text-muted-foreground text-sm">{t("noneYet")}</p>
        ) : (
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs">{t("versionLabel")}</dt>
              <dd className="text-foreground font-medium">{status.version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("acceptedAtLabel")}</dt>
              <dd className="text-foreground font-medium">
                {status.acceptedAt ? formatDate(status.acceptedAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">{t("acceptedByLabel")}</dt>
              <dd className="text-foreground font-medium">
                {status.acceptedByName ?? "—"}
                {status.acceptedByEmail ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({status.acceptedByEmail})
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
