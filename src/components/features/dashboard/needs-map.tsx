"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  GeoMapPoint,
  PriorityBand,
} from "@/services/geographic-dashboard/geographic-dashboard.types";

/**
 * RIO-FR-008 — the needs map itself.
 *
 * Deliberately separate from `leaflet-map.tsx`: that one draws study counts
 * as identical black-and-white pins, and has already been stretched once (see
 * its `unitLabel` prop). This map's whole job is that the colour carries
 * priority and the size carries volume, so bending the other component would
 * have made both harder to read.
 */

/** Colours are ordered by severity and stay distinguishable in greyscale, so
 *  a printed report does not lose the ranking. Not the app's accent hue —
 *  these encode meaning, not brand. */
export const BAND_COLOURS: Record<PriorityBand | "unscored", string> = {
  critical: "#B4232A",
  high: "#D9760F",
  medium: "#C9A227",
  low: "#3F7D58",
  unscored: "#8A9299",
};

export interface NeedsMapProps {
  points: GeoMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Copy comes from the parent so this file holds no translation keys. */
  labels: {
    needs: (count: number) => string;
    unscored: string;
    initiatives: (count: number) => string;
    empty: string;
    /** e.g. "approximate — within 40km". */
    approximate: (km: number) => string;
    /** Priority band name — the raw enum value ("critical", "high", ...) is
     *  never shown directly. */
    band: (band: PriorityBand) => string;
  };
}

/** Marker diameter from need count. Area, not radius, tracks the count — a
 *  linear radius makes ten needs look a hundred times worse than one. */
function diameterFor(count: number, max: number): number {
  const min = 26;
  const span = 30;
  if (max <= 1) return min;
  return Math.round(min + span * Math.sqrt(count / max));
}

function markerElement(
  point: GeoMapPoint,
  size: number,
  selected: boolean,
  onSelect: () => void,
  labels: NeedsMapProps["labels"],
): HTMLElement {
  const band = point.priorityBand ?? "unscored";
  const colour = BAND_COLOURS[band];

  const root = document.createElement("div");
  root.className = "flex cursor-pointer flex-col items-center select-none";
  root.tabIndex = 0;
  root.role = "button";
  root.setAttribute(
    "aria-label",
    `${point.name}: ${labels.needs(point.needCount)}, ${
      point.priorityBand ? labels.band(point.priorityBand) : labels.unscored
    }${point.isApproximate ? `, ${labels.approximate(Math.round((point.accuracyM ?? 0) / 1000))}` : ""}`,
  );
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  });

  const bubble = document.createElement("div");
  // An approximate point is drawn hollow with a dashed edge: the colour and
  // the count still read at a glance, but it can never be mistaken for a
  // surveyed location. A solid fill here would quietly imply a precision
  // this coordinate does not have.
  const approx = point.isApproximate;
  bubble.style.cssText = `
    width:${size}px;height:${size}px;border-radius:9999px;
    display:flex;align-items:center;justify-content:center;
    background:${approx ? "rgba(255,255,255,.82)" : colour};
    color:${approx ? colour : "#fff"};
    font-weight:700;
    font-size:${size > 34 ? 13 : 11}px;
    border:${
      selected
        ? `3px solid #111827`
        : approx
          ? `2px dashed ${colour}`
          : "2px solid rgba(255,255,255,.9)"
    };
    box-shadow:${approx ? "none" : "0 1px 4px rgba(0,0,0,.35)"};
    transition:transform .15s ease;
  `;
  bubble.textContent = String(point.needCount);

  const name = document.createElement("div");
  name.style.cssText =
    "margin-top:2px;font-size:10px;font-weight:600;color:#111827;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff;";
  name.textContent = point.name;

  root.append(bubble, name);
  return root;
}

export function NeedsMap({ points, selectedId, onSelect, labels }: NeedsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const ksaBounds: L.LatLngBoundsExpression = [
      [16.0, 34.0],
      [32.5, 55.5],
    ];
    const map = L.map(containerRef.current, {
      center: [24.0, 45.0],
      zoom: 5.4,
      // Below the 5 this used to sit at: fitBounds never picks a zoom under
      // minZoom, so a floor of 5 clamped the fit on shorter panels and left
      // the country overflowing the frame instead of fitting inside it.
      minZoom: 4,
      maxZoom: 11,
      maxBounds: ksaBounds,
      maxBoundsViscosity: 1.0,
      scrollWheelZoom: false,
      // The view is fixed on the Kingdom. Everything outside it is masked out
      // below, so there is nothing to pan to — and a map that slides off the
      // country under a stray drag or arrow key reads as broken. Each of these
      // is a separate way to move the centre, so all of them have to go.
      dragging: false,
      keyboard: false,
      boxZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
    });
    // `animate: false` is required, not cosmetic: an animated fitBounds right
    // after L.map() schedules Leaflet's 250ms transition timer, which React
    // Strict Mode's double-invoked effect outlives — the cleanup below removes
    // the map and the timer then throws on a detached pane.
    map.fitBounds(ksaBounds, { padding: [12, 12], animate: false });

    // OpenStreetMap's own tiles rather than CartoDB's: the CartoDB basemap
    // now stamps "API KEY REQUIRED" across every tile, which on a map read
    // for funding priority looks like a broken product. OSM needs no key.
    // Attribution is required by its licence, so the control stays on.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 5,
      maxZoom: 11,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Grey out everything that is not Saudi Arabia, so the eye is not drawn to
    // Iran or Egypt on a map read for funding priority inside the Kingdom.
    //
    // The boundaries are real (geoBoundaries ADM1, simplified to ~1 km and
    // served from /public) rather than drawn by hand. An approximate outline
    // was visibly wrong along the Gulf coast, and on a map whose whole job is
    // to say *where* a need is, a border nobody trusts undermines the dots.
    //
    // Fetched rather than imported so the 45 KB never enters the JS bundle;
    // the browser caches it like any other static asset. If it fails the map
    // still works — it just loses the mask, which beats rendering nothing.
    let cancelled = false;
    void fetch("/sa-regions.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((regions: GeoJSON.FeatureCollection) => {
        if (cancelled || !mapRef.current) return;

        // One polygon covering the world, with every region punched out of it.
        // Rings after the first are holes, and the regions tile the country, so
        // their union is exactly the Kingdom. Building the mask from the same
        // data that draws the borders keeps the two from ever disagreeing.
        // Only outer rings are used: a region's own holes are lakes, not gaps
        // in the country, and punching those through would grey them out.
        const holes: GeoJSON.Position[][] = [];
        for (const f of regions.features) {
          const polys =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates]
              : f.geometry.type === "MultiPolygon"
                ? f.geometry.coordinates
                : [];
          for (const poly of polys) if (poly[0]) holes.push(poly[0]);
        }

        // interactive: false on both layers matters. Either one sits above the
        // tiles and would otherwise swallow the clicks meant for the need
        // markers underneath, making every dot on the map unselectable.
        L.geoJSON(
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-180, -85],
                  [180, -85],
                  [180, 85],
                  [-180, 85],
                  [-180, -85],
                ],
                ...holes,
              ],
            },
          } as GeoJSON.Feature,
          {
            interactive: false,
            style: { stroke: false, fillColor: "#eef1f5", fillOpacity: 0.95 },
          },
        ).addTo(map);

        // Region divisions: hairline and pale, so they read as context behind
        // the markers rather than competing with them. No fill — the base map
        // inside the Kingdom is the part worth seeing, and a wash over it left
        // the country as flat as the masked-out area around it.
        const outline = L.geoJSON(regions, {
          interactive: false,
          style: { color: "#94a3b8", weight: 0.8, opacity: 0.9, fill: false },
        }).addTo(map);

        // Frame the country by its real extent rather than the hard-coded box,
        // which was wider than the Kingdom and left the shape cut off against
        // the panel edges.
        //
        // Order matters. invalidateSize() first, because this runs after a
        // fetch and the panel may have been laid out since the map was built —
        // fitting against a stale size is what leaves the country floating in
        // the middle of the frame. maxBounds last, because setting it first
        // constrains the very fit being computed.
        const bounds = outline.getBounds();
        map.invalidateSize({ animate: false });
        map.fitBounds(bounds, { padding: [8, 8], animate: false });
        map.setMaxBounds(bounds.pad(0.05));
      })
      .catch(() => {
        /* mask unavailable — the map and its markers still render */
      });

    return () => {
      // Stops the fetch above from touching a map this cleanup has removed —
      // React Strict Mode runs the effect twice, so the first request is
      // usually still in flight when the first map is torn down.
      cancelled = true;
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const max = points.reduce((m, p) => Math.max(m, p.needCount), 0);
    for (const point of points) {
      const size = diameterFor(point.needCount, max);
      const el = markerElement(
        point,
        size,
        point.id === selectedId,
        () => onSelect(point.id),
        labels,
      );
      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          html: el.outerHTML,
          className: "",
          iconSize: [size, size + 14],
          iconAnchor: [size / 2, size / 2],
        }),
      });
      marker.on("click", () => onSelect(point.id));
      marker.bindTooltip(
        `<strong>${point.name}</strong><br/>${labels.needs(point.needCount)}` +
          `<br/>${point.priorityBand ? labels.band(point.priorityBand) : labels.unscored}` +
          (point.initiativeCount > 0
            ? `<br/>${labels.initiatives(point.initiativeCount)}`
            : "") +
          // Says the quiet part out loud: this dot is an estimate, and by
          // roughly how much.
          (point.isApproximate
            ? `<br/><em>${labels.approximate(Math.round((point.accuracyM ?? 0) / 1000))}</em>`
            : ""),
        { direction: "top", offset: [0, -size / 2] },
      );
      marker.addTo(layer);
    }
  }, [points, selectedId, onSelect, labels]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="border-border/40 h-[26rem] w-full rounded-xl border"
      />
      {points.length === 0 ? (
        <div className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
          {labels.empty}
        </div>
      ) : null}
    </div>
  );
}
