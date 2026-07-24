import { useEffect, useState } from "react";
import { geographyService } from "@/services/geography/geography.service";
import type { Center, Governorate } from "@/services/geography/geography.types";
import type { Study } from "@/services/studies/studies.types";

/** Resolves a Study's own governorateIds to full Governorate objects — the
 * Need Governorate picker offers only these, never the org's full
 * selection. Non-fatal on failure: the picker just renders with no
 * options. */
export function useStudyGovernorates(study: Study | null): Governorate[] {
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const key = study ? [...study.governorateIds].sort().join(",") : "";

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    const load =
      ids.length === 0
        ? Promise.resolve([])
        : geographyService.listGovernorates().then((all) => {
            const idSet = new Set(ids);
            return all.filter((g) => idSet.has(g.id));
          });
    load
      .then((resolved) => {
        if (!cancelled) setGovernorates(resolved);
      })
      .catch(() => {
        // Non-fatal — see doc comment above.
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return governorates;
}

/** Resolves a Study's own centerIds to full Center objects — the Need
 * Center picker offers only these, never the org's full selection.
 * Non-fatal on failure: the picker just renders with no options. */
export function useStudyCenters(study: Study | null): Center[] {
  const [centers, setCenters] = useState<Center[]>([]);
  const governorateKey = study ? [...study.governorateIds].sort().join(",") : "";
  const centerKey = study ? [...study.centerIds].sort().join(",") : "";

  useEffect(() => {
    let cancelled = false;
    const governorateIds = governorateKey ? governorateKey.split(",") : [];
    const centerIds = centerKey ? centerKey.split(",") : [];
    const load =
      governorateIds.length === 0 || centerIds.length === 0
        ? Promise.resolve([])
        : Promise.all(governorateIds.map((id) => geographyService.listCenters(id))).then(
            (lists) => {
              const idSet = new Set(centerIds);
              return lists.flat().filter((c) => idSet.has(c.id));
            },
          );
    load
      .then((resolved) => {
        if (!cancelled) setCenters(resolved);
      })
      .catch(() => {
        // Non-fatal — see doc comment above.
      });
    return () => {
      cancelled = true;
    };
  }, [governorateKey, centerKey]);

  return centers;
}
