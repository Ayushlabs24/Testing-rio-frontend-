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
 * Always uses `listPublic()` (name + nameAr, active domains only, gated by
 * authentication alone) — never `list()`/`listWithSubDomains()`, which
 * require `methodologyQuestionBank:read`. Most roles hold no such grant at
 * all (e.g. ngo_admin — Methodology Configuration is System Admin only,
 * client-confirmed 2026-08-20), so an ngo_admin editing their OWN
 * organization's sector on Settings > Organization got a silently empty
 * options list and their sector displayed in English with no way to see it
 * translated — the exact same 403-swallowed-into-empty-list bug found and
 * fixed in useDomainArabicMap. `authenticated` no longer changes which
 * endpoint is called (both branches used the same shape already); kept as a
 * parameter only so existing call sites don't need to change.
 *
 * Returns `{ name, nameAr }` pairs, not plain strings — every caller of this
 * hook was rendering the raw English `name` directly regardless of the UI
 * locale (a real Arabic-readiness gap: the sector dropdown on Sign Up and
 * the Organization settings sector field stayed in English even with
 * Arabic selected). Callers must localize the label themselves and keep
 * `name` as the value.
 */
export function useSectorOptions(authenticated: boolean = true): SectorOption[] {
  void authenticated;
  const [options, setOptions] = useState<SectorOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    domainsService
      .listPublic()
      .then((domains) => {
        if (!cancelled)
          setOptions(domains.map((d) => ({ name: d.name, nameAr: d.nameAr })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
