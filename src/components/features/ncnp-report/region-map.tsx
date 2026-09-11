"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import { geographyService } from "@/services/geography/geography.service";
import type { NcnpNamedBreakdown } from "@/services/ncnp-report/ncnp-report.types";

// Same dynamic import (SSR disabled, Leaflet needs `window`) and the same
// underlying map engine GeographicDistribution already uses for the system
// dashboard — reused here rather than adding a second map implementation.
const LeafletMapContainer = dynamic(
  () =>
    import("@/components/features/dashboard/leaflet-map").then(
      (m) => m.LeafletMapContainer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/20 border-border/40 text-muted-foreground flex h-[420px] w-full animate-pulse items-center justify-center rounded-xl border text-xs">
        Loading map…
      </div>
    ),
  },
);

// Real GPS coordinates for KSA's 13 regions (same source as
// GeographicDistribution's KSA_REGION_COORDS), keyed by Region.code — the
// reference workbook's own 1-13 numbering (see prisma/schema.prisma /
// KSA_Geographic_Reference_EN.xlsx), NOT the region name.
//
// The name is a DISPLAY value: every region now carries a populated
// `name_ar`, so a name-keyed lookup misses on all 13 rows the moment this
// renders in Arabic and the map silently loses every marker, with no error
// to notice. The code is master data and does not move with the display
// language. Kept in sync with ncnp-report-pdf.ts's identical table.
//
// Deliberately region-level, not governorate-level: this platform has no
// GPS coordinates for its ~150 governorates anywhere (KSA_Geographic_
// Reference_EN.xlsx has governorate codes/names/hierarchy, not lat/lng) —
// plotting governorate-level pins would mean fabricating coordinates,
// which this report avoids throughout. Region-level is real and accurate.
const KSA_REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  1: { lat: 24.7136, lng: 46.6753 }, // Riyadh
  2: { lat: 21.3891, lng: 39.8579 }, // Makkah Al-Mukarramah
  3: { lat: 24.5247, lng: 39.5692 }, // Madinah Al-Munawwarah
  4: { lat: 26.326, lng: 43.975 }, // Al-Qassim
  5: { lat: 26.4207, lng: 50.0888 }, // Eastern Province
  6: { lat: 18.2164, lng: 42.5053 }, // Aseer
  7: { lat: 28.3835, lng: 36.5662 }, // Tabuk
  8: { lat: 27.5219, lng: 41.6961 }, // Hail
  9: { lat: 30.9753, lng: 41.0381 }, // Northern Borders
  10: { lat: 16.8894, lng: 42.5511 }, // Jazan
  11: { lat: 17.4924, lng: 44.1277 }, // Najran
  12: { lat: 20.0129, lng: 41.4676 }, // Al-Baha
  13: { lat: 29.9697, lng: 40.2064 }, // Al-Jouf
};

interface RegionMapProps {
  data: NcnpNamedBreakdown[];
  // A stable (module-level constant, not an inline literal) [singular,
  // plural] tuple — passing a fresh array literal here on every render
  // would force LeafletMapContainer to rebuild every marker each render.
  unitLabel: readonly [string, string];
}

export function RegionMap({ data, unitLabel }: RegionMapProps) {
  const locale = useLocale() as AppLocale;
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // The NCNP payload is not backend-localized (see this file's header note):
  // `d.name` is always the English region name. Resolve each one to its
  // `name_ar` from the Region master list so the Arabic report's map labels
  // match the rest of the page. Non-fatal — falls back to the English name.
  const [regionNameAr, setRegionNameAr] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    let cancelled = false;
    geographyService
      .listRegions()
      .then((regions) => {
        if (!cancelled) {
          setRegionNameAr(new Map(regions.map((r) => [r.id, r.nameAr])));
        }
      })
      .catch(() => {
        // Non-fatal — English names remain.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markers = useMemo(
    () =>
      data
        .filter((d) => KSA_REGION_COORDS[d.code])
        .map((d) => ({
          regionId: d.id,
          name: localizedName({ name: d.name, nameAr: regionNameAr.get(d.id) }, locale),
          lat: KSA_REGION_COORDS[d.code]!.lat,
          lng: KSA_REGION_COORDS[d.code]!.lng,
          studyCount: d.count, // field name is generic-by-reuse — see LeafletMapContainer's unitLabel prop
        })),
    [data, regionNameAr, locale],
  );
  const maxCount = Math.max(1, ...markers.map((m) => m.studyCount));

  return (
    // LeafletMapContainer renders at `size-full` — it has no intrinsic
    // height of its own and collapses to zero without an explicitly sized
    // parent (same wrapper GeographicDistribution uses for this component).
    <div className="h-[420px] w-full overflow-hidden rounded-xl">
      <LeafletMapContainer
        markers={markers}
        selectedRegionId={selectedRegionId}
        onSelectRegion={setSelectedRegionId}
        maxStudies={maxCount}
        unitLabel={unitLabel}
      />
    </div>
  );
}
