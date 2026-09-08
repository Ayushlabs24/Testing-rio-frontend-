import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { domainsService } from "@/services/domains/domains.service";
import type { PublicDomainTreeOption } from "@/services/domains/domains.types";

export interface DomainArabicMap {
  /** Resolves a plain Domain name string to its Arabic name when the UI is
   * in Arabic and the master list has one; returns the name unchanged
   * otherwise (English UI, or no Arabic value configured yet). */
  localizedDomain: (name: string) => string;
  localizedSubDomain: (name: string) => string;
}

/**
 * A Need/AI-decision/report record stores Domain and Sub-domain as plain
 * denormalized English name strings (`Need.domain`, `.aiSuggestedDomain`,
 * `.proposedDomains[].domain`, etc. — see the Need model's schema comment),
 * not an id + its own nameAr. Showing one of these in Arabic means resolving
 * it against the live Domain/Sub-domain master list's nameAr instead — the
 * same fix already applied once in questions-tab.tsx for
 * Question.domain/subDomain, pulled out here so every other screen with the
 * same denormalized-string problem (AI Classification, the dashboard's
 * "leading domain", Survey Builder, Priority Dashboard, ...) can reuse it
 * rather than re-deriving its own copy.
 *
 * Deliberately keyed by name, not id — that's the shape these denormalized
 * fields already come in, and it also degrades safely: a name with no match
 * in the current master list (renamed or deactivated since) just falls back
 * to showing itself unchanged rather than a blank/broken lookup.
 */
export function useDomainArabicMap(): DomainArabicMap {
  const locale = useLocale() as AppLocale;
  const [domainsTree, setDomainsTree] = useState<PublicDomainTreeOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    // `listPublicTree()`, not `listWithSubDomains()` — this hook is called
    // from screens reachable by every role (Survey Builder, Initiatives,
    // Data Quality, dashboards, ...), and most roles hold no
    // `methodologyQuestionBank` grant at all (e.g. ngo_admin —
    // client-confirmed 2026-08-20). `listWithSubDomains()` 403'd for those
    // roles, and the catch below silently left `domainsTree` empty forever —
    // every localizedDomain/localizedSubDomain call then fell back to
    // showing the raw English name with no visible error anywhere. Found
    // 2026-09-08 tracing a persistent "domain still shows in English" report
    // that survived several rounds of otherwise-correct localization fixes.
    domainsService
      .listPublicTree()
      .then((tree) => {
        if (!cancelled) setDomainsTree(tree);
      })
      .catch(() => {
        if (!cancelled) setDomainsTree([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const domainNameToAr = useMemo(
    () => new Map(domainsTree.map((d) => [d.name, d.nameAr])),
    [domainsTree],
  );
  const subDomainNameToAr = useMemo(
    () =>
      new Map(domainsTree.flatMap((d) => d.subDomains.map((sd) => [sd.name, sd.nameAr]))),
    [domainsTree],
  );

  return useMemo(
    () => ({
      localizedDomain: (name: string) =>
        locale === "ar" ? (domainNameToAr.get(name) ?? name) : name,
      localizedSubDomain: (name: string) =>
        locale === "ar" ? (subDomainNameToAr.get(name) ?? name) : name,
    }),
    [locale, domainNameToAr, subDomainNameToAr],
  );
}
