import { useEffect, useState } from "react";
import { geographyService } from "@/services/geography/geography.service";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { Center } from "@/services/geography/geography.types";

/** The current org's own selected Centers (Settings > Organization) that
 * also belong to one of the given Governorates — the Study Center picker
 * offers only these, never every Center under those Governorates. Returns
 * an empty list while `governorateIds` is empty. Non-fatal on failure: the
 * picker just renders with no options.
 *
 * `loaded` is derived by comparing the last-resolved key against the
 * current one — `false` until the fetch for the *current* `governorateIds`
 * has settled. Callers that prune a stale selection against `centers` must
 * wait for `loaded` first, otherwise they'd prune against the empty
 * initial state before the real list ever arrives and wipe out a value
 * that was actually still valid. */
export function useOrgCentersForGovernorates(governorateIds: string[]): {
  centers: Center[];
  loaded: boolean;
} {
  const [centers, setCenters] = useState<Center[]>([]);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const key = [...governorateIds].sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    const load =
      ids.length === 0
        ? Promise.resolve([])
        : organizationsService.getCurrent().then(async (org) => {
            const lists = await Promise.all(
              ids.map((id) => geographyService.listCenters(id)),
            );
            if (!org.centerIds || org.centerIds.length === 0) {
              return [];
            }
            const idSet = new Set(org.centerIds);
            return lists.flat().filter((c) => idSet.has(c.id));
          });
    load
      .then((resolved) => {
        if (cancelled) return;
        setCenters(resolved);
        setResolvedKey(key);
      })
      .catch(() => {
        // Non-fatal — see doc comment above.
        if (!cancelled) setResolvedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { centers, loaded: resolvedKey === key };
}
