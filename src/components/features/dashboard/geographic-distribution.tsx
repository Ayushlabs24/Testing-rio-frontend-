"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight, Building2, Globe2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Link } from "@/i18n/navigation";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import { cn } from "@/lib/utils";
import { geographicDashboardService } from "@/services/geographic-dashboard/geographic-dashboard.service";
import {
  PRIORITY_BANDS,
  type GeoItemKind,
  type GeoLevel,
  type GeoMapResponse,
} from "@/services/geographic-dashboard/geographic-dashboard.types";
import { BAND_COLOURS } from "./needs-map";
import { PointItemsDialog } from "./point-items-dialog";

// Leaflet needs `window`, so the map itself only loads in the browser.
const NeedsMap = dynamic(() => import("./needs-map").then((m) => m.NeedsMap), {
  ssr: false,
  loading: () => (
    <div className="bg-muted/20 border-border/40 h-[26rem] w-full animate-pulse rounded-2xl border" />
  ),
});

const ALL = "all";

/**
 * RIO-FR-008 — the Geographic Dashboard.
 *
 * One map answers both of this dashboard's questions: where the needs are
 * (priority colour, counts, filters, initiative links) and who is working
 * there (studies and organisations per place). They were briefly two
 * separate panels, which put two maps on one screen and made the reader
 * choose between them.
 *
 * Everything now comes from a single `/geographic-dashboard/map` call.
 * Before, this component fetched studies and then made one request per
 * study to load its needs — an N+1 that grew with the data — and placed
 * regions from thirteen coordinates hard-coded in this file, inventing a
 * position for anything it could not match. Coordinates now come from the
 * database, and a place without one is simply not drawn.
 *
 * `variant` still decides how much cross-entity detail is shown; a
 * crossEntity role's request already returns every organisation's needs,
 * while an ordinary tenant sees only its own.
 */
export function GeographicDistribution({
  variant,
  className,
}: {
  variant: "ncnp" | "ngo";
  className?: string;
}) {
  const t = useTranslations("systemAdmin.dashboard");
  const tMap = useTranslations("app.dashboard.needsMap");
  // Urgency and status arrive as the raw enum values the database stores
  // ("this_cycle", "ai_classified"). The Studies screens already translate
  // exactly these, so reuse those labels rather than inventing a second set
  // that would drift.
  const tUrgency = useTranslations("app.studies.urgency");
  const tStatus = useTranslations("app.studies.status");
  const tInitiativeStatus = useTranslations("app.initiatives.statusValues");
  const { localizedDomain } = useDomainArabicMap();

  // Center is the default: it is the finest grain the client's own
  // geographic reference goes to, and 1,022 of the 1,404 centers now carry a
  // geocoded coordinate. Region and governorate remain one click away for a
  // coarser read.
  const [level, setLevel] = useState<GeoLevel>("center");
  const [sector, setSector] = useState<string>(ALL);
  const [urgency, setUrgency] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [data, setData] = useState<GeoMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which of the panel's figures is open as a list, or null for none.
  const [itemsKind, setItemsKind] = useState<GeoItemKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    geographicDashboardService
      .getMap({
        level,
        sector: sector === ALL ? undefined : sector,
        urgency: urgency === ALL ? undefined : urgency,
        status: status === ALL ? undefined : status,
      })
      .then((res) => {
        if (cancelled) return;
        setFailed(false);
        setData(res);
        setLoading(false);
        // Drop a selection the filters just removed, so the side panel never
        // describes a place that is no longer on the map.
        setSelectedId((current) =>
          current && res.points.some((p) => p.id === current) ? current : null,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [level, sector, urgency, status]);

  const selected = useMemo(
    () => data?.points.find((p) => p.id === selectedId) ?? null,
    [data, selectedId],
  );

  // Memoised because the dialog lists this object in an effect dependency: a
  // new object on every render would refetch the list in a loop. ALL is the
  // "no filter" sentinel and must not be sent as a value.
  const itemFilters = useMemo(
    () => ({
      sector: sector === ALL ? undefined : sector,
      urgency: urgency === ALL ? undefined : urgency,
      status: status === ALL ? undefined : status,
    }),
    [sector, urgency, status],
  );

  const labels = useMemo(
    () => ({
      needs: (count: number) => tMap("needsCount", { count }),
      unscored: tMap("band.unscored"),
      initiatives: (count: number) => tMap("initiativesCount", { count }),
      empty: tMap("noPlaces"),
      approximate: (km: number) => tMap("approximate", { km }),
      band: (band: (typeof PRIORITY_BANDS)[number]) => tMap(`band.${band}`),
    }),
    [tMap],
  );

  const onSelect = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);

  const coverage = data?.coverage;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-foreground flex items-center gap-2.5 text-lg font-bold">
            <Globe2 className="text-primary size-5" />
            {t("geoTitle", { defaultValue: "Geographic distribution" })}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">{tMap("description")}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {t("geoBadge", { defaultValue: "Interactive geographic analytics" })}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Controls. Level first — it changes what the other filters apply to. */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={level} onValueChange={(v) => setLevel(v as GeoLevel)}>
            <SelectTrigger className="h-8 w-[9.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="region">{tMap("level.region")}</SelectItem>
              <SelectItem value="governorate">{tMap("level.governorate")}</SelectItem>
              <SelectItem value="center">{tMap("level.center")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="h-8 w-[9.5rem] text-xs">
              <SelectValue placeholder={tMap("filter.sector")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tMap("filter.allSectors")}</SelectItem>
              {(data?.available.sectors ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  <AutoTranslate text={s} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger className="h-8 w-[9rem] text-xs">
              <SelectValue placeholder={tMap("filter.urgency")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tMap("filter.allUrgencies")}</SelectItem>
              {(data?.available.urgencies ?? []).map((u) => (
                <SelectItem key={u} value={u}>
                  {tUrgency.has(u) ? tUrgency(u) : u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[9rem] text-xs">
              <SelectValue placeholder={tMap("filter.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{tMap("filter.allStatuses")}</SelectItem>
              {(data?.available.statuses ?? []).map((s) => (
                <SelectItem key={s} value={s}>
                  {tStatus.has(s) ? tStatus(s) : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Legend. Colour and size both carry meaning, so both are named. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {PRIORITY_BANDS.map((band) => (
            <span key={band} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: BAND_COLOURS[band] }}
              />
              {tMap(`band.${band}`)}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ background: BAND_COLOURS.unscored }}
            />
            {tMap("band.unscored")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full border-2 border-dashed"
              style={{ borderColor: BAND_COLOURS.unscored }}
            />
            {tMap("approximateLegend")}
          </span>
          <span className="text-muted-foreground">{tMap("sizeHint")}</span>
        </div>

        {failed ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {tMap("loadFailed")}
          </p>
        ) : loading ? (
          <div className="bg-muted/20 border-border/40 h-[26rem] w-full animate-pulse rounded-2xl border" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Map (7/12) */}
            <div className="lg:col-span-7">
              <NeedsMap
                points={data?.points ?? []}
                selectedId={selectedId}
                onSelect={onSelect}
                labels={labels}
              />
            </div>

            {/* Detail panel (5/12) */}
            <div className="border-border/40 bg-card flex flex-col rounded-2xl border p-5 shadow-sm lg:col-span-5">
              {selected ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-foreground text-xl font-bold">
                      <AutoTranslate text={selected.name} />
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-sm font-medium">
                      {variant === "ncnp"
                        ? t("geoOrgsActive", { count: selected.orgCount })
                        : selected.regionName}
                    </p>
                  </div>

                  {/* Needs first: this is a needs dashboard, and the count is
                      what the map is sized by. */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <Stat
                      value={selected.needCount}
                      label={tMap("statNeeds")}
                      onClick={() => setItemsKind("needs")}
                    />
                    <Stat
                      value={selected.studyCount}
                      label={t("geoStudies")}
                      onClick={() => setItemsKind("studies")}
                    />
                    {variant === "ncnp" ? (
                      // No onClick: the endpoint lists needs and studies, not
                      // organisations.
                      <Stat value={selected.orgCount} label={t("geoOrgs")} />
                    ) : (
                      <Stat
                        value={selected.publishedCount}
                        label={t("geoPublished")}
                        onClick={() => setItemsKind("published")}
                      />
                    )}
                  </div>

                  {/* Priority breakdown — explains the marker's colour. */}
                  <div className="space-y-1.5">
                    <PanelLabel>{tMap("statPriority")}</PanelLabel>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      {PRIORITY_BANDS.filter((b) => selected.priorityCounts[b] > 0).map(
                        (b) => (
                          <span key={b} className="flex items-center gap-1.5">
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ background: BAND_COLOURS[b] }}
                            />
                            {tMap(`band.${b}`)}: {selected.priorityCounts[b]}
                          </span>
                        ),
                      )}
                      {selected.priorityCounts.unscored > 0 ? (
                        <span className="text-muted-foreground">
                          {tMap("band.unscored")}: {selected.priorityCounts.unscored}
                        </span>
                      ) : null}
                    </div>
                    {selected.isApproximate ? (
                      <Badge variant="outline" className="border-dashed text-xs">
                        {tMap("approximate", {
                          km: Math.round((selected.accuracyM ?? 0) / 1000),
                        })}
                      </Badge>
                    ) : null}
                  </div>

                  {selected.leadingDomain ? (
                    <div className="space-y-1">
                      <PanelLabel>{t("geoLeadingDomain")}</PanelLabel>
                      <p className="text-foreground text-base font-bold">
                        {localizedDomain(selected.leadingDomain)}
                      </p>
                    </div>
                  ) : null}

                  {/* RIO-FR-009 AC — links, not just a count. */}
                  {selected.initiatives.length > 0 ? (
                    <div className="space-y-2">
                      <PanelLabel>{tMap("linkedInitiatives")}</PanelLabel>
                      <div className="flex flex-col gap-1">
                        {selected.initiatives.map((i) => (
                          <Link
                            key={i.id}
                            href="/initiatives"
                            className="text-primary inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
                          >
                            <AutoTranslate text={i.name} />
                            <span className="text-muted-foreground text-xs">
                              (
                              {tInitiativeStatus.has(i.status)
                                ? tInitiativeStatus(i.status)
                                : i.status}
                              )
                            </span>
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                        ))}
                      </div>
                      {selected.initiativeCount > selected.initiatives.length ? (
                        <span className="text-muted-foreground text-xs">
                          {tMap("moreInitiatives", {
                            count: selected.initiativeCount - selected.initiatives.length,
                          })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {variant === "ncnp" ? (
                    <div className="space-y-2">
                      <PanelLabel>{t("geoWorkingOrgs")}</PanelLabel>
                      {selected.workingOrgs.length > 0 ? (
                        <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                          {selected.workingOrgs.map((org) => (
                            <Row
                              key={org.name}
                              icon={<Building2 className="text-primary size-4" />}
                              name={<AutoTranslate text={org.name} />}
                              meta={`${org.studyCount} ${
                                org.studyCount === 1
                                  ? t("studySingular")
                                  : t("studyPlural")
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty>{t("geoNoOrgs")}</Empty>
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <PanelLabel>{t("geoVillagesWithStudies")}</PanelLabel>
                    {selected.villages.length > 0 ? (
                      <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                        {selected.villages.map((v) => (
                          <Row
                            key={v}
                            icon={<MapPin className="text-primary size-4" />}
                            name={<AutoTranslate text={v} />}
                          />
                        ))}
                      </div>
                    ) : (
                      <Empty>{t("geoNoVillages")}</Empty>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm italic">
                  {t("geoSelectPrompt")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* What the map is not showing. A dashboard that quietly omits most
            of the data is worse than one that admits it. */}
        {coverage && !loading && !failed ? (
          <p className="text-muted-foreground text-xs">
            {tMap("coverage", {
              plotted: coverage.needsPlotted,
              total: coverage.needsTotal,
            })}
            {coverage.needsWithoutLocation > 0
              ? ` ${tMap("coverageMissingLocation", { count: coverage.needsWithoutLocation })}`
              : ""}
            {coverage.placesWithoutCoordinates > 0
              ? ` ${tMap("coverageMissingCoordinates", { count: coverage.placesWithoutCoordinates })}`
              : ""}
          </p>
        ) : null}

        {/* The rows behind whichever figure was clicked. Rendered once here
            rather than per Stat so only one list can ever be open, and it is
            handed the same filters the map is currently showing. */}
        <PointItemsDialog
          pointId={itemsKind && selected ? selected.id : null}
          pointName={selected?.name ?? ""}
          kind={itemsKind ?? "needs"}
          level={level}
          filters={itemFilters}
          onClose={() => setItemsKind(null)}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Counts from zero up to `target` whenever it changes, so selecting a place on
 * the map reads as its figures arriving rather than silently swapping.
 *
 * Returns `target` immediately when the reader has asked for reduced motion.
 * That is not a nicety here: these are four numbers animating at once, in a
 * panel that re-renders on every map click, and for a motion-sensitive reader
 * that is exactly the kind of repeated movement the setting exists to stop.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// Read through useSyncExternalStore rather than an effect: the preference is
// external state that can change mid-session, and subscribing to it keeps the
// first render correct instead of painting an animation and then cancelling it.
const subscribeToReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false, // server render: assume motion is fine, the client corrects it
  );
}

function useCountUp(target: number, durationMs = 850): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (reduced || target === 0) return;
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      // Clamped at both ends. rAF hands back the frame's own start timestamp,
      // which can predate the performance.now() taken a moment earlier — that
      // makes the elapsed time negative, and easeOutCubic then renders a
      // negative count on the first frame (observed: "-7" before "157").
      const t = Math.min(1, Math.max(0, (now - started) / durationMs));
      // easeOutCubic: fast first, settling onto the final figure rather than
      // stopping dead on it.
      setDisplay(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduced]);

  return reduced ? target : display;
}

function Stat({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  /** Omitted for figures with nothing to open — the Organisations count on the
   *  NCNP view has no drill-down, and a tile that looks clickable but is not
   *  is worse than one that plainly is not. */
  onClick?: () => void;
}) {
  const shown = useCountUp(value);

  // aria-label carries the settled figure so a screen reader announces the
  // result once, instead of every intermediate frame. tabular-nums keeps the
  // digits from jittering as the width of each numeral changes.
  const body = (
    <>
      <p
        className="text-foreground text-2xl leading-none font-extrabold tabular-nums"
        aria-label={`${value} ${label}`}
      >
        <span aria-hidden="true">{shown}</span>
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs font-semibold">{label}</p>
    </>
  );

  const shell = "bg-muted/30 border-border/50 rounded-xl border p-3.5 text-center";
  if (!onClick) return <div className={shell}>{body}</div>;

  // A real button, not a div with a handler: this has to be reachable by
  // keyboard and announced as actionable, like any other control that opens a
  // dialog. Zero counts stay disabled — an empty list answers nothing.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={value === 0}
      className={`${shell} hover:bg-muted/60 hover:border-border focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent`}
    >
      {body}
    </button>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
      {children}
    </span>
  );
}

function Row({
  icon,
  name,
  meta,
}: {
  icon: React.ReactNode;
  name: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="bg-muted/20 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="text-foreground truncate font-semibold">{name}</span>
      </div>
      {meta ? (
        <span className="text-muted-foreground shrink-0 text-xs font-medium">{meta}</span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm italic">{children}</p>;
}
