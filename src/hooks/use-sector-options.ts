import { useEffect, useState } from "react";
import { domainsService } from "@/services/domains/domains.service";

export interface SectorOption {
  name: string;
  // RIO Arabic Localization — Approach 3 (Hybrid). Callers render this via
  // `localizedName`/`localizedText` from @/lib/bilingual; `name` stays the
  // value actually submitted/matched against (the Domain's stable English
  // name), so switching the UI locale never changes what gets saved.
  nameAr: string | null;
}

/**
 * Live sector options sourced from Methodology Configuration's active Domain
 * list — never a hardcoded set, so every sector dropdown in the app stays in
 * lockstep with whatever domains are actually configured there. Does NOT
 * include "other" — callers append that themselves (it's a fixed escape
 * hatch, not a domain, and each caller renders/handles it slightly
 * differently: some pair it with a free-text field, some don't).
 *
 * `authenticated: false` is for the public signup form (reached pre-login,
 * before any session exists) — it hits the name-only public endpoint instead
 * of the full authenticated one.
 *
 * Returns `{ name, nameAr }` pairs, not plain strings — every caller of this
 * hook was rendering the raw English `name` directly regardless of the UI
 * locale (a real Arabic-readiness gap: the sector dropdown on Sign Up and
 * the Organization settings sector field stayed in English even with
 * Arabic selected). Callers must localize the label themselves and keep
 * `name` as the value.
 */
export function useSectorOptions(authenticated: boolean = true): SectorOption[] {
  const [options, setOptions] = useState<SectorOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = authenticated
      ? domainsService
          .list()
          .then((domains) =>
            domains
              .filter((d) => d.isActive)
              .map((d) => ({ name: d.name, nameAr: d.nameAr })),
          )
      : domainsService
          .listPublic()
          .then((domains) => domains.map((d) => ({ name: d.name, nameAr: d.nameAr })));
    load
      .then((result) => {
        if (!cancelled) setOptions(result);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  return options;
}
