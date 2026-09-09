"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createMarkerIconElement } from "./leaflet-map.utils";

export interface MapRegionMarker {
  regionId: string;
  name: string;
  centerName?: string;
  lat: number;
  lng: number;
  studyCount: number;
}

interface LeafletMapProps {
  markers: MapRegionMarker[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string) => void;
  maxStudies: number;
  /** [singular, plural] label for the count each marker's `studyCount`
   * field actually represents — that field name is literal only for this
   * component's original caller; other callers reuse the same marker
   * engine for a different metric (e.g. organization counts) and label it
   * accordingly via this prop. Defaults to "study"/"studies". */
  unitLabel?: readonly [string, string];
}

export function LeafletMapContainer({
  markers,
  selectedRegionId,
  onSelectRegion,
  maxStudies,
  unitLabel,
}: LeafletMapProps) {
  const t = useTranslations("systemAdmin.dashboard");
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Strict Geographic Bounds for Saudi Arabia (SW lat/lng to NE lat/lng)
    const ksaBounds: L.LatLngBoundsExpression = [
      [16.0, 34.0], // South-West corner
      [32.5, 55.5], // North-East corner
    ];

    // Initialize map bounded strictly to KSA
    const map = L.map(containerRef.current, {
      center: [24.0, 45.0],
      zoom: 5.8,
      minZoom: 5,
      maxZoom: 10,
      maxBounds: ksaBounds,
      maxBoundsViscosity: 1.0, // Prevents panning outside Saudi Arabia
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // Fit map view tightly around Saudi Arabia. `animate: false` is required,
    // not cosmetic: an animated fitBounds right after L.map() schedules
    // Leaflet's 250ms `_onZoomTransitionEnd` timer, which React Strict Mode's
    // double-invoked effect outlives — the cleanup below calls map.remove(),
    // the pane is detached, and the timer then throws
    // "Cannot read properties of undefined (reading '_leaflet_pos')".
    map.fitBounds(ksaBounds, { padding: [10, 10], animate: false });

    // OpenStreetMap's own tiles. CartoDB's Positron basemap now stamps
    // "API KEY REQUIRED" across every tile, which made this map look broken
    // on all five dashboards that render it. OSM needs no key; its licence
    // requires the attribution control, so that is left enabled below.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 5,
      maxZoom: 10,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // Crisp Saudi Arabia Outer Boundary GeoJSON Overlay (makes country border dark & clearly visible)
    const ksaGeoJson: GeoJSON.Feature = {
      type: "Feature",
      properties: { name: "Saudi Arabia" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [34.5, 28.5],
            [36.0, 29.5],
            [38.0, 31.5],
            [39.0, 32.0],
            [42.0, 31.0],
            [44.5, 33.3],
            [47.5, 30.0],
            [48.5, 29.8],
            [48.5, 28.5],
            [50.5, 26.5],
            [51.5, 26.0],
            [50.8, 24.5],
            [51.5, 23.0],
            [55.5, 22.5],
            [55.0, 20.0],
            [53.0, 19.0],
            [52.0, 19.0],
            [47.0, 16.5],
            [43.0, 16.5],
            [42.6, 16.3],
            [42.5, 17.5],
            [41.5, 18.5],
            [40.0, 20.0],
            [39.5, 21.5],
            [39.0, 23.0],
            [37.5, 25.0],
            [36.5, 27.5],
            [34.5, 28.5],
          ],
        ],
      },
    };

    L.geoJSON(ksaGeoJson, {
      style: {
        color: "#1f2937", // Dark gray crisp outer border line
        weight: 2.2,
        opacity: 0.85,
        fillColor: "#e5e7eb",
        fillOpacity: 0.15,
      },
    }).addTo(map);

    // Internal Province Division Boundary Lines (crisp dashed lines separating regions)
    const internalBordersGeoJson: GeoJSON.Feature = {
      type: "Feature",
      properties: { type: "province_borders" },
      geometry: {
        type: "MultiLineString",
        coordinates: [
          // Riyadh — Eastern division
          [
            [45.0, 29.0],
            [45.5, 26.5],
            [46.5, 24.0],
            [47.5, 21.0],
            [48.0, 19.5],
          ],
          // Riyadh — Qassim — Hail division
          [
            [43.5, 27.5],
            [44.5, 25.5],
            [45.5, 24.5],
          ],
          // Madinah — Makkah division
          [
            [38.5, 24.0],
            [40.0, 23.5],
            [41.5, 23.0],
          ],
          // Asir — Jizan — Najran division
          [
            [41.0, 19.0],
            [42.5, 18.0],
            [44.0, 17.5],
          ],
          // Tabuk — Jawf — Northern borders division
          [
            [36.5, 29.5],
            [38.5, 29.8],
            [41.0, 30.5],
          ],
          // Qassim — Madinah division
          [
            [41.0, 26.0],
            [42.5, 25.5],
            [43.5, 25.0],
          ],
          // Eastern — Najran division
          [
            [47.0, 20.0],
            [49.0, 20.5],
            [51.0, 21.5],
          ],
          // Makkah — Bahah — Asir division
          [
            [39.5, 21.5],
            [41.0, 20.0],
            [42.0, 19.0],
          ],
        ],
      },
    };

    L.geoJSON(internalBordersGeoJson, {
      style: {
        color: "#374151", // Visible dark slate internal border line
        weight: 1.6, // Clearly visible thickness
        opacity: 0.8,
        dashArray: "4 3", // Stylized dashed border line
      },
    }).addTo(map);

    mapRef.current = map;

    return () => {
      // stop() aborts any in-flight pan/zoom animation and off() drops the
      // pane's transitionend listener, so nothing can call back into a map
      // whose panes remove() is about to detach.
      map.stop();
      map.off();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    markers.forEach((m) => {
      const isSelected = m.regionId === selectedRegionId;
      // Calculate circle size (24px to 44px)
      const size = 26 + Math.round((m.studyCount / (maxStudies || 1)) * 14);
      const half = Math.round(size / 2);

      const iconElement = createMarkerIconElement(
        m,
        isSelected,
        size,
        () => onSelectRegion(m.regionId),
        unitLabel,
      );

      const customIcon = L.divIcon({
        html: iconElement,
        className: "custom-map-marker",
        iconSize: [120, size + 36],
        iconAnchor: [60, half + 18],
      });

      const leafletMarker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);

      leafletMarker.on("click", () => {
        onSelectRegion(m.regionId);
      });

      markersRef.current.set(m.regionId, leafletMarker);
    });
  }, [markers, selectedRegionId, maxStudies, onSelectRegion, unitLabel]);

  return (
    <div className="border-border/40 relative size-full overflow-hidden rounded-xl border">
      <style jsx global>{`
        .leaflet-tile-container img {
          filter: contrast(1.15) brightness(0.98);
        }
      `}</style>
      <div ref={containerRef} className="size-full bg-[#e8e6e1]" />
      <div className="text-muted-foreground/80 pointer-events-none absolute right-3 bottom-2 z-[1000] font-sans text-[10px]">
        {t("geoBasemapAttribution")}
      </div>
    </div>
  );
}
