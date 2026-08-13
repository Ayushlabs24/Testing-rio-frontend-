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
 * One consent's row: its name, the accepted version and when. A null version
 * means that consent is outstanding — shown explicitly rather than as a dash,
 * since "not yet accepted" is materially different from "no data".
 */
function ConsentRow({
  label,
  version,
  acceptedAt,
  versionLabel,
  acceptedAtLabel,
  outstandingLabel,
}: {
  label: string;
  version: string | null;
  acceptedAt: string | null;
  versionLabel: string;
  acceptedAtLabel: string;
  outstandingLabel: string;
}) {
  return (
    <div>
      <p className="text-foreground text-sm font-medium">{label}</p>
      {version === null ? (
        <p className="text-muted-foreground mt-1 text-sm">{outstandingLabel}</p>
      ) : (
        <dl className="mt-2 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">{versionLabel}</dt>
            <dd className="text-foreground font-medium">{version}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{acceptedAtLabel}</dt>
            <dd className="text-foreground font-medium">
              {acceptedAt ? formatDate(acceptedAt) : "—"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
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
        ) : status.usePolicy.version === null && status.dataSharing.version === null ? (
          <p className="text-muted-foreground text-sm">{t("noneYet")}</p>
        ) : (
          <div className="space-y-5">
            {/* RIO-DATA-001 — the two consents are reported independently:
                an org that registered before the data-sharing consent
                existed shows the use policy accepted and the sharing one
                outstanding, which is the state the consent gate acts on. */}
            <ConsentRow
              label={t("usePolicyLabel")}
              version={status.usePolicy.version}
              acceptedAt={status.usePolicy.acceptedAt}
              versionLabel={t("versionLabel")}
              acceptedAtLabel={t("acceptedAtLabel")}
              outstandingLabel={t("outstanding")}
            />
            <ConsentRow
              label={t("dataSharingLabel")}
              version={status.dataSharing.version}
              acceptedAt={status.dataSharing.acceptedAt}
              versionLabel={t("versionLabel")}
              acceptedAtLabel={t("acceptedAtLabel")}
              outstandingLabel={t("outstanding")}
            />
            <div className="border-border border-t pt-4">
              <dt className="text-muted-foreground text-xs">{t("acceptedByLabel")}</dt>
              <dd className="text-foreground text-sm font-medium">
                {status.acceptedByName ?? "—"}
                {status.acceptedByEmail ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({status.acceptedByEmail})
                  </span>
                ) : null}
              </dd>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
