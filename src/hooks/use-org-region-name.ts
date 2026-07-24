import { useEffect, useState } from "react";
import { geographyService } from "@/services/geography/geography.service";
import { organizationsService } from "@/services/organizations/organizations.service";

/** The current org's own selected Region (Settings > Organization), resolved
 * to a display name — the Study form's read-only Region row shows this,
 * never lets it be picked directly (Study inherits it from the org).
 * Non-fatal on failure: renders as an empty string if it can't load. */
export function useOrgRegionName(): string {
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    organizationsService
      .getCurrent()
      .then(async (org) => {
        if (!org.regionId) return "";
        const regions = await geographyService.listRegions();
        return regions.find((r) => r.id === org.regionId)?.name ?? "";
      })
      .then((resolved) => {
        if (!cancelled) setName(resolved);
      })
      .catch(() => {
        // Non-fatal — see doc comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}
