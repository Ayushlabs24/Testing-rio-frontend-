import { useEffect, useState } from "react";
import { geographyService } from "@/services/geography/geography.service";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { Governorate } from "@/services/geography/geography.types";

/** The current org's own selected Governorates (Settings > Organization),
 * as full objects — the structured Study/Need Governorate picker offers
 * only these, never the full 150-row KSA reference list. Non-fatal on
 * failure: the picker just renders with no options.
 *
 * `actAsOrgId` — System Admin only: when set, resolves the CHOSEN org's
 * governorates instead of the caller's own (System Admin's own home org has
 * none linked — see act-as-org.ts). Re-fetches whenever it changes. */
export function useOrgGovernorates(actAsOrgId?: string): Governorate[] {
  const [governorates, setGovernorates] = useState<Governorate[]>([]);

  useEffect(() => {
    let cancelled = false;
    organizationsService
      .getCurrent(actAsOrgId)
      .then(async (org) => {
        if (org.governorateIds.length === 0) return [];
        const all = await geographyService.listGovernorates();
        const idSet = new Set(org.governorateIds);
        return all.filter((g) => idSet.has(g.id));
      })
      .then((resolved) => {
        if (!cancelled) setGovernorates(resolved);
      })
      .catch(() => {
        // Non-fatal — see doc comment above.
      });
    return () => {
      cancelled = true;
    };
  }, [actAsOrgId]);

  return governorates;
}
