"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Compass } from "lucide-react";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";
import { geographyService } from "@/services/geography/geography.service";
import type { Governorate, Region } from "@/services/geography/geography.types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import type { MapRegionMarker } from "./leaflet-map";
import { getVerifiedNeedStatusCounts, NO_RECORDED_RESPONSES } from "./dashboard-metrics";

// Dynamically import LeafletMapContainer with SSR disabled (Leaflet needs `window`)
const LeafletMapContainer = dynamic(
  () => import("./leaflet-map").then((m) => m.LeafletMapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/20 border-border/40 text-muted-foreground flex h-80 w-full animate-pulse items-center justify-center rounded-xl border text-xs">
        Loading interactive basemap...
      </div>
    ),
  },
);

// 13 Saudi Regions mapped to real GPS lat/lng coordinates, keyed by
// Region.code — the KSA Geographic Reference's own 1-13 numbering, which the
// geography API already returns on every Region row.
//
// This used to be keyed by informal short names ("Makkah", "Qassim") and
// matched with a fuzzy `region.name.includes(key)` substring test, which had
// two problems beyond localization: any rename of a region upstream silently
// stopped matching, and a name that contains another key's text can match the
// wrong entry. Keying on the code is an exact lookup against master data that
// does not move with the display language, so the display name is now free to
// be the Arabic one without a comment having to warn future readers not to
// touch it. Same table, same keying, as ncnp-report-pdf.ts and region-map.tsx.
const KSA_REGION_COORDS: Record<
  string,
  { lat: number; lng: number; centerName?: string }
> = {
  1: { lat: 24.7136, lng: 46.6753, centerName: "Central Administrative Centre" }, // Riyadh
  2: { lat: 21.3891, lng: 39.8579, centerName: "Western Administrative Centre" }, // Makkah Al-Mukarramah
  3: { lat: 24.5247, lng: 39.5692, centerName: "Central Administrative Centre" }, // Madinah Al-Munawwarah
  4: { lat: 26.326, lng: 43.975, centerName: "Northern Administrative Centre" }, // Al-Qassim
  5: { lat: 26.4207, lng: 50.0888, centerName: "Eastern Administrative Centre" }, // Eastern Province
  6: { lat: 18.2164, lng: 42.5053, centerName: "Southern Administrative Centre" }, // Aseer
  7: { lat: 28.3835, lng: 36.5662, centerName: "Northern Administrative Centre" }, // Tabuk
  8: { lat: 27.5219, lng: 41.6961, centerName: "Northern Administrative Centre" }, // Hail
  9: { lat: 30.9753, lng: 41.0381, centerName: "Northern Administrative Centre" }, // Northern Borders
  10: { lat: 16.8894, lng: 42.5511, centerName: "Southern Administrative Centre" }, // Jazan
  11: { lat: 17.4924, lng: 44.1277, centerName: "Southern Administrative Centre" }, // Najran
  12: { lat: 20.0129, lng: 41.4676, centerName: "Western Administrative Centre" }, // Al-Baha
  13: { lat: 29.9697, lng: 40.2064, centerName: "Northern Administrative Centre" }, // Al-Jouf
};

interface VillageSummary {
  name: string;
  studyCount: number;
  responseCount: number;
}

interface OrgWorkSummary {
  name: string;
  studyCount: number;
}

interface RegionMapData {
  regionId: string;
  name: string;
  centerName?: string;
  /** Null when this region has no real coordinate (a row outside the
   *  reference's 1-13 codes). The region still appears in the list and the
   *  detail panel; it is simply not plotted, rather than being plotted at a
   *  made-up location. */
  lat: number | null;
  lng: number | null;
  studyCount: number;
  orgCount: number;
  responseCount: number;
  publishedCount: number;
  draftCount: number;
  leadingDomain: string;
  workingOrgs: OrgWorkSummary[];
  villages: VillageSummary[];
  isFallbackCoverage?: boolean;
}

interface GeographicDistributionProps {
  variant: "ncnp" | "ngo";
  className?: string;
}

export function GeographicDistribution({
  variant,
  className,
}: GeographicDistributionProps) {
  const t = useTranslations("systemAdmin.dashboard");
  const locale = useLocale() as AppLocale;
  const { localizedDomain } = useDomainArabicMap();

  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [regs, govs, orgs, stds] = await Promise.all([
          geographyService.listRegions().catch(() => []),
          geographyService.listGovernorates().catch(() => []),
          organizationsService.listAll().catch(() => []),
          studiesService.list({ limit: 100 }).catch(() => []),
        ]);

        setRegions(regs);
        setGovernorates(govs);
        setOrganizations(orgs);
        setStudies(stds);

        // Fetch needs per study
        if (stds.length > 0) {
          const needsByStudy = await Promise.all(
            stds.map((s) => needsService.listByStudy(s.id).catch(() => [])),
          );
          setNeeds(needsByStudy.flat());
        }
      } catch {
        // Fallbacks stay empty arrays
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Aggregate map data per region
  const regionMapDataList = useMemo<RegionMapData[]>(() => {
    if (regions.length === 0) return [];

    return regions.map((region) => {
      // Exact lookup on the region's own master-data code. The previous
      // fallback synthesised coordinates off the array index
      // (`24.0 + (idx % 3)`), which put a marker at a plausible-looking but
      // entirely made-up place on the map — worse than showing nothing,
      // because nothing about the pin said it was invented. An unmatched
      // region now carries no coordinate and is skipped by `mapMarkers`
      // while keeping its row in the list and detail panel.
      const coords = KSA_REGION_COORDS[String(region.code)];

      // Find governorates in this region
      const regionGovIds = new Set(
        governorates.filter((g) => g.regionId === region.id).map((g) => g.id),
      );

      // Find studies that touch this region
      const regionStudies = studies.filter((std) =>
        std.governorateIds?.some((gid) => regionGovIds.has(gid)),
      );

      // Find orgs working in this region
      const regionOrgs = organizations.filter(
        (org) =>
          org.regionId === region.id ||
          org.governorateIds?.some((gid) => regionGovIds.has(gid)),
      );

      // Collect needs in this region's studies
      const studyIdsInRegion = new Set(regionStudies.map((s) => s.id));
      const regionNeeds = needs.filter((n) => studyIdsInRegion.has(n.studyId));

      // Domain counts for leading domain
      const domainCounts: Record<string, number> = {};
      regionNeeds.forEach((n) => {
        if (n.domain) {
          domainCounts[n.domain] = (domainCounts[n.domain] || 0) + 1;
        }
      });
      let leadingDomain = "-";
      let maxCount = 0;
      Object.entries(domainCounts).forEach(([dom, cnt]) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          leadingDomain = dom;
        }
      });

      // Villages
      const villageMap = new Map<string, { studyIds: Set<string>; responses: number }>();
      regionNeeds.forEach((n) => {
        (n.village || []).forEach((v) => {
          if (!v) return;
          const curr = villageMap.get(v) || { studyIds: new Set(), responses: 0 };
          curr.studyIds.add(n.studyId);
          curr.responses = NO_RECORDED_RESPONSES;
          villageMap.set(v, curr);
        });
      });

      const villagesList: VillageSummary[] = Array.from(villageMap.entries()).map(
        ([vName, vData]) => ({
          name: vName,
          studyCount: vData.studyIds.size,
          responseCount: vData.responses,
        }),
      );

      const workingOrgsList: OrgWorkSummary[] = regionOrgs.map((org) => ({
        name: org.name,
        studyCount: org.studyCount ?? 0,
      }));

      const { publishedCount, draftCount } = getVerifiedNeedStatusCounts(regionNeeds);

      return {
        regionId: region.id,
        // Free to follow the UI locale: the coordinate lookup above keys on
        // `region.code`, not on this, so localizing the display name can no
        // longer break the map.
        name: localizedName(region, locale),
        centerName: coords?.centerName,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        studyCount: regionStudies.length,
        orgCount: regionOrgs.length,
        responseCount: NO_RECORDED_RESPONSES,
        publishedCount,
        draftCount,
        leadingDomain:
          leadingDomain === "-" ? leadingDomain : localizedDomain(leadingDomain),
        workingOrgs: workingOrgsList,
        villages: villagesList,
        isFallbackCoverage: regionStudies.length === 0 && regionOrgs.length > 0,
      };
    });
  }, [regions, governorates, organizations, studies, needs, locale, localizedDomain]);

  const activeSelectedRegionId = useMemo(() => {
    if (selectedRegionId) return selectedRegionId;
    if (regionMapDataList.length === 0) return null;
    const highest = [...regionMapDataList].sort((a, b) => b.studyCount - a.studyCount)[0];
    return highest?.regionId ?? regionMapDataList[0].regionId;
  }, [regionMapDataList, selectedRegionId]);

  const selectedData = useMemo(() => {
    if (!activeSelectedRegionId) return null;
    return (
      regionMapDataList.find((r) => r.regionId === activeSelectedRegionId) ??
      regionMapDataList[0]
    );
  }, [regionMapDataList, activeSelectedRegionId]);

  const maxStudies = useMemo(() => {
    return Math.max(...regionMapDataList.map((r) => r.studyCount), 1);
  }, [regionMapDataList]);

  const mapMarkers = useMemo<MapRegionMarker[]>(() => {
    return regionMapDataList
      .filter(
        (r): r is RegionMapData & { lat: number; lng: number } =>
          r.lat !== null && r.lng !== null,
      )
      .map((r) => ({
        regionId: r.regionId,
        name: r.name,
        centerName: r.centerName,
        lat: r.lat,
        lng: r.lng,
        studyCount: r.studyCount,
      }));
  }, [regionMapDataList]);

  return (
    <Card className={`border-border/60 shadow-sm ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="text-foreground flex items-center gap-2.5 text-lg font-bold">
            <Compass className="text-primary size-5.5" />
            {t("geoTitle", { defaultValue: "Geographic distribution" })}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {t("geoSubtitle", { defaultValue: "Click a province to view details" })}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-border text-muted-foreground px-3 py-1 text-xs font-semibold"
        >
          {t("geoBadge", { defaultValue: "Interactive geographic analytics" })}
        </Badge>
      </CardHeader>

      <CardContent className="p-6 pt-0">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Interactive Leaflet Map Column (7/12) */}
            <div className="bg-muted/20 border-border/40 relative flex flex-col justify-between rounded-2xl border p-4 lg:col-span-7">
              <div className="h-[420px] w-full overflow-hidden rounded-xl">
                <LeafletMapContainer
                  markers={mapMarkers}
                  selectedRegionId={activeSelectedRegionId}
                  onSelectRegion={setSelectedRegionId}
                  maxStudies={maxStudies}
                />
              </div>

              {/* Map Legend Footer */}
              <div className="border-border/40 mt-3 flex flex-wrap items-center justify-between border-t pt-3 text-xs">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-background border-foreground size-3.5 rounded-full border-2" />
                    <span className="text-muted-foreground font-medium">
                      {t("geoLegendProvince")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-foreground border-background size-3.5 rounded-full border-2 shadow-sm" />
                    <span className="text-foreground font-bold">
                      {t("geoLegendSelected")}
                    </span>
                  </div>
                </div>
                <span className="text-muted-foreground/80 text-xs font-medium">
                  {t("geoLegendVolume")}
                </span>
              </div>
            </div>

            {/* Region Detail Side Panel (5/12) */}
            <div className="border-border/40 bg-card flex flex-col justify-between rounded-2xl border p-5 shadow-sm lg:col-span-5">
              {selectedData ? (
                <div className="space-y-5">
                  {/* Title & Scope header */}
                  <div>
                    <h3 className="text-foreground text-xl font-bold">
                      {selectedData.name}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-sm font-medium">
                      {variant === "ncnp"
                        ? t("geoOrgsActive", { count: selectedData.orgCount })
                        : t("geoOperationalScope")}
                    </p>
                  </div>

                  {/* Top Stats Cards inside panel */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-muted/30 border-border/50 rounded-xl border p-3.5 text-center">
                      <p className="text-foreground text-2xl leading-none font-extrabold tabular-nums">
                        {selectedData.studyCount}
                      </p>
                      <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
                        {t("geoStudies")}
                      </p>
                    </div>

                    {variant === "ncnp" ? (
                      <div className="bg-muted/30 border-border/50 rounded-xl border p-3.5 text-center">
                        <p className="text-foreground text-2xl leading-none font-extrabold tabular-nums">
                          {selectedData.orgCount}
                        </p>
                        <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
                          {t("geoOrgs")}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-muted/30 border-border/50 rounded-xl border p-3.5 text-center">
                        <p className="text-foreground text-2xl leading-none font-extrabold tabular-nums">
                          {selectedData.publishedCount}
                        </p>
                        <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
                          {t("geoPublished")}
                        </p>
                      </div>
                    )}

                    <div className="bg-muted/30 border-border/50 rounded-xl border p-3.5 text-center">
                      <p className="text-foreground text-2xl leading-none font-extrabold tabular-nums">
                        {selectedData.responseCount}
                      </p>
                      <p className="text-muted-foreground mt-1.5 text-xs font-semibold">
                        {t("geoResponses")}
                      </p>
                    </div>
                  </div>

                  {/* Leading Domain */}
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      {t("geoLeadingDomain")}
                    </span>
                    <p className="text-foreground text-base font-bold">
                      {selectedData.leadingDomain}
                    </p>
                  </div>

                  {/* NCNP View: Working Organisations list */}
                  {variant === "ncnp" && (
                    <div className="space-y-2">
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        {t("geoWorkingOrgs")}
                      </span>
                      {selectedData.workingOrgs.length > 0 ? (
                        <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                          {selectedData.workingOrgs.map((org, i) => (
                            <div
                              key={i}
                              className="bg-muted/20 flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="text-primary size-4" />
                                <span className="text-foreground font-semibold">
                                  <AutoTranslate text={org.name} />
                                </span>
                              </div>
                              <span className="text-muted-foreground text-xs font-medium">
                                {org.studyCount}{" "}
                                {org.studyCount === 1
                                  ? t("studySingular")
                                  : t("studyPlural")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">
                          {t("geoNoOrgs")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Villages list */}
                  <div className="space-y-2">
                    <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                      {t("geoVillagesWithStudies")}
                    </span>
                    {selectedData.villages.length > 0 ? (
                      <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                        {selectedData.villages.map((v, i) => (
                          <div
                            key={i}
                            className="bg-muted/20 flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="text-primary size-4" />
                              <span className="text-foreground font-semibold">
                                <AutoTranslate text={v.name} />
                              </span>
                            </div>
                            <span className="text-muted-foreground text-xs font-medium">
                              {v.studyCount}{" "}
                              {v.studyCount === 1 ? t("studySingular") : t("studyPlural")}{" "}
                              · {v.responseCount} {t("responsesShort")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        {selectedData.isFallbackCoverage
                          ? t("geoFallbackCoverage")
                          : t("geoNoVillages")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm italic">
                  {t("geoSelectPrompt")}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
