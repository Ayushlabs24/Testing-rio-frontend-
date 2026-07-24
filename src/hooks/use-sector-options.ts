import { useEffect, useState } from "react";
import { domainsService } from "@/services/domains/domains.service";

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
 */
export function useSectorOptions(authenticated: boolean = true): string[] {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = authenticated
      ? domainsService.list().then((domains) =>
          domains.filter((d) => d.isActive).map((d) => d.name),
        )
      : domainsService.listPublic().then((domains) => domains.map((d) => d.name));
    load
      .then((result) => {
        if (!cancelled) setNames(result);
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  return names;
}
