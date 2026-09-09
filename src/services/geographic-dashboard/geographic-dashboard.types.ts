// RIO-FR-008 — Geographic Dashboard.
//
// `level` is a parameter, not a hard-coded choice. The BRD asks for villages,
// but villages are free text here with no coordinates, so the dashboard ships
// at governorate level — the finest grain that can actually be placed on a
// map today. Center is wired end to end already and starts returning points
// the moment the backend's `centers.latitude` is seeded.

export const GEO_LEVELS = ["region", "governorate", "center"] as const;
export type GeoLevel = (typeof GEO_LEVELS)[number];

/** Worst first — the order the legend renders in. */
export const PRIORITY_BANDS = ["critical", "high", "medium", "low"] as const;
export type PriorityBand = (typeof PRIORITY_BANDS)[number];

/** Just enough of an Initiative to name it and link to it. */
export interface GeoMapInitiative {
  id: string;
  name: string;
  status: string;
  domain: string | null;
}

/** One organisation's footprint at a place — the NCNP view lists these. */
export interface GeoMapOrgSummary {
  name: string;
  studyCount: number;
}

export interface GeoMapPoint {
  id: string;
  code: string;
  name: string;
  regionName: string;
  latitude: number;
  longitude: number;
  needCount: number;
  /** Worst band present here; null when nothing at this place is scored yet,
   *  which must look different from "scored and low". */
  priorityBand: PriorityBand | null;
  priorityCounts: Record<PriorityBand | "unscored", number>;
  initiativeCount: number;
  /** RIO-FR-009 — the initiatives themselves, so the panel can link to them
   *  rather than only saying how many there are. Capped server-side. */
  initiatives: GeoMapInitiative[];
  topSector: string | null;
  /** Metres the true location might be from this point. */
  accuracyM: number | null;
  /** A fallback point placed at the governorate centre because the place
   *  itself could not be geocoded. Drawn differently on purpose — an
   *  estimate that looks like a surveyed location misleads whoever reads
   *  funding priority off this map. */
  isApproximate: boolean;

  // The study / organisation view this dashboard also carries, folded into
  // the same response so one call answers both of its questions.
  studyCount: number;
  /** Distinct organisations with a study here. Only meaningful to a
   *  cross-entity viewer; an org sees only itself. */
  orgCount: number;
  /** Needs here that have cleared human review. */
  publishedCount: number;
  leadingDomain: string | null;
  workingOrgs: GeoMapOrgSummary[];
  /** Free-text village names recorded on this place's needs. */
  villages: string[];
}

export interface GeoMapCoverage {
  needsTotal: number;
  needsPlotted: number;
  /** Needs with no location at this level. Shown to the user rather than
   *  hidden — a map that silently omits most of the data misleads. */
  needsWithoutLocation: number;
  placesWithoutCoordinates: number;
}

export interface GeoMapResponse {
  level: GeoLevel;
  points: GeoMapPoint[];
  coverage: GeoMapCoverage;
  available: { sectors: string[]; urgencies: string[]; statuses: string[] };
}

export interface GeoMapParams {
  level?: GeoLevel;
  sector?: string;
  urgency?: string;
  status?: string;
}
