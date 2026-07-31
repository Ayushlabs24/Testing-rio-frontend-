"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
// GeographicDistribution's KSA_REGION_COORDS), keyed by each region's real
// name as returned by the Region master-data table (see
// prisma/schema.prisma / KSA_Geographic_Reference_EN.xlsx) — not the
// informal short names that dashboard component uses internally.
//
// Deliberately region-level, not governorate-level: this platform has no
// GPS coordinates for its ~150 governorates anywhere (KSA_Geographic_
// Reference_EN.xlsx has governorate codes/names/hierarchy, not lat/lng) —
// plotting governorate-level pins would mean fabricating coordinates,
// which this report avoids throughout. Region-level is real and accurate.
const KSA_REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  Riyadh: { lat: 24.7136, lng: 46.6753 },
  "Makkah Al-Mukarramah": { lat: 21.3891, lng: 39.8579 },
  "Madinah Al-Munawwarah": { lat: 24.5247, lng: 39.5692 },
  "Al-Qassim": { lat: 26.326, lng: 43.975 },
  "Eastern Province": { lat: 26.4207, lng: 50.0888 },
  Aseer: { lat: 18.2164, lng: 42.5053 },
  Tabuk: { lat: 28.3835, lng: 36.5662 },
  Hail: { lat: 27.5219, lng: 41.6961 },
  "Northern Borders": { lat: 30.9753, lng: 41.0381 },
  Jazan: { lat: 16.8894, lng: 42.5511 },
  Najran: { lat: 17.4924, lng: 44.1277 },
  "Al-Baha": { lat: 20.0129, lng: 41.4676 },
  "Al-Jouf": { lat: 29.9697, lng: 40.2064 },
};

interface RegionMapProps {
  data: NcnpNamedBreakdown[];
  // A stable (module-level constant, not an inline literal) [singular,
  // plural] tuple — passing a fresh array literal here on every render
  // would force LeafletMapContainer to rebuild every marker each render.
  unitLabel: readonly [string, string];
}

export function RegionMap({ data, unitLabel }: RegionMapProps) {
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  const markers = data
    .filter((d) => KSA_REGION_COORDS[d.name])
    .map((d) => ({
      regionId: d.id,
      name: d.name,
      lat: KSA_REGION_COORDS[d.name]!.lat,
      lng: KSA_REGION_COORDS[d.name]!.lng,
      studyCount: d.count, // field name is generic-by-reuse — see LeafletMapContainer's unitLabel prop
    }));
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
