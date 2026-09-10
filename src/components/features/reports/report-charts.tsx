"use client";

import { AutoTranslate } from "@/components/common/auto-translate";

// Small, dependency-free chart primitives for the report viewer, styled with
// the app's theme-aware --chart-* tokens (light/dark safe). Categorical hues
// are assigned in fixed order, never cycled; every chart carries a legend with
// direct value + percentage labels so identity is never colour-alone.

export function StatTiles({
  items,
}: {
  // `sub` is a qualifier under the label ("38 of 42 valid", "2 active") — the
  // context that stops a bare count being read out of proportion.
  items: Array<{ label: string; value: string | number; sub?: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Label alone is not a safe key — two domains can legitimately share a
          name (e.g. duplicate "Social Development" rollups), which React
          reports as a duplicate-key error and can drop a tile. */}
      {items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          className="border-border bg-muted/30 rounded-lg border p-3"
        >
          <p dir="auto" className="text-foreground text-xl font-semibold tabular-nums">
            {typeof it.value === "string" && /\p{L}{2,}/u.test(it.value) ? (
              <AutoTranslate text={it.value} />
            ) : (
              it.value
            )}
          </p>
          <p dir="auto" className="text-muted-foreground mt-0.5 text-xs">
            <AutoTranslate text={it.label} />
          </p>
          {it.sub ? (
            <p dir="auto" className="text-muted-foreground/80 mt-0.5 text-[11px]">
              <AutoTranslate text={it.sub} />
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Paired bars for one set of categories across two series — the gap between the
// two bars is the point, so they share a scale and sit adjacent rather than in
// two separate charts the reader has to mentally align.
export function GroupedBarChart({
  groups,
  series,
  max,
}: {
  groups: string[];
  series: Array<{ name: string; values: number[]; color: string }>;
  max: number;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {groups.map((group, gi) => (
          <div key={`${group}-${gi}`} className="space-y-1">
            <p
              dir="auto"
              className="text-muted-foreground truncate text-xs"
              title={group}
            >
              <AutoTranslate text={group} />
            </p>
            {series.map((s) => (
              <div
                key={s.name}
                className="grid grid-cols-[1fr_2.5rem] items-center gap-3 text-sm"
              >
                <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${max > 0 ? Math.min(100, ((s.values[gi] ?? 0) / max) * 100) : 0}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <span className="text-foreground text-right font-medium tabular-nums">
                  {Math.round(s.values[gi] ?? 0)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span
            key={s.name}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            <AutoTranslate text={s.name} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  bars,
  max,
}: {
  bars: Array<{ label: string; value: number }>;
  max: number;
}) {
  return (
    <div className="space-y-2.5">
      {/* Index-suffixed key — bar labels repeat (duplicate domain names). */}
      {bars.map((b, i) => (
        <div
          key={`${b.label}-${i}`}
          className="grid grid-cols-[10rem_1fr_2.5rem] items-center gap-3 text-sm"
        >
          <span dir="auto" className="text-muted-foreground truncate" title={b.label}>
            <AutoTranslate text={b.label} />
          </span>
          <div className="bg-muted h-3 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${max > 0 ? Math.min(100, (b.value / max) * 100) : 0}%` }}
            />
          </div>
          <span className="text-foreground text-right font-medium tabular-nums">
            {b.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Radial gauge — a single headline metric on a 0–max ring. Reads as a report
// figure, not a dashboard tile.
export function Gauge({
  value,
  max,
  label,
  sub,
  color = "var(--chart-1)",
  scaleNote,
}: {
  value: number;
  max: number;
  label: string;
  sub?: string;
  color?: string;
  /** States the scale the dial is on — a ring with a bare number in it does not
   *  say whether 51 is good or bad, or out of what. */
  scaleNote?: string;
}) {
  const size = 168;
  const stroke = 15;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, value / max)) * circ;
  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${value}`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
          opacity={0.4}
        />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
          />
        </g>
        <text
          x={cx}
          y={cy - 1}
          textAnchor="middle"
          className="fill-foreground text-3xl font-bold"
        >
          {Math.round(value)}
        </text>
        {sub ? (
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            className="fill-muted-foreground text-xs font-semibold"
          >
            {sub}
          </text>
        ) : null}
      </svg>
      <p dir="auto" className="text-foreground mt-1.5 text-center text-xs font-medium">
        <AutoTranslate text={label} />
      </p>
      {scaleNote ? (
        <p className="text-muted-foreground text-center text-[11px]">{scaleNote}</p>
      ) : null}
    </div>
  );
}

// Radar / spider chart — compares several axes for one or two series (e.g. a
// domain's severity vs. performance profile). A quintessential "report" figure.
export function RadarChart({
  axes,
  series,
  max,
  size = 280,
  ariaLabel = "Domain profile",
}: {
  axes: string[];
  series: Array<{ name: string; values: number[]; color: string }>;
  max: number;
  size?: number;
  /** Localized accessible name for the figure — the caller has the
   * translation context, this pure chart component does not. */
  ariaLabel?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 52; // leave room for axis labels
  const n = axes.length || 1;
  const angle = (i: number) => ((-90 + (i * 360) / n) * Math.PI) / 180;
  const at = (i: number, frac: number): [number, number] => [
    cx + r * frac * Math.cos(angle(i)),
    cy + r * frac * Math.sin(angle(i)),
  ];
  const ringPoly = (frac: number) => axes.map((_, i) => at(i, frac).join(",")).join(" ");
  const seriesPoly = (values: number[]) =>
    values.map((v, i) => at(i, Math.max(0, Math.min(1, v / max))).join(",")).join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={ringPoly(f)}
            fill="none"
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = at(i, 1);
          const [lx, ly] = [
            cx + (r + 16) * Math.cos(angle(i)),
            cy + (r + 16) * Math.sin(angle(i)),
          ];
          const cos = Math.cos(angle(i));
          const anchor = Math.abs(cos) < 0.3 ? "middle" : cos > 0 ? "start" : "end";
          return (
            <g key={`${a}-${i}`}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {a}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <polygon
            key={s.name}
            points={seriesPoly(s.values)}
            fill={s.color}
            fillOpacity={0.16}
            stroke={s.color}
            strokeWidth={2}
          />
        ))}
      </svg>
      {series.length > 1 ? (
        <ul className="flex flex-wrap justify-center gap-4 text-xs">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">
                <AutoTranslate text={s.name} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Donut (pie) chart — best for a small composition (2–4 categories) like gender
// or rural/urban split. SVG stroke-arc segments with a 2px gap between fills.
export function DonutChart({
  data,
  colorVars,
  centerLabel,
}: {
  data: Array<{ label: string; value: number }>;
  colorVars: string[];
  centerLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = 132;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = 2; // px surface gap between segments

  const segments = data.map((d, i) => {
    const frac = d.value / total;
    const len = Math.max(0, frac * circ - gap);
    // Cumulative offset of the preceding slices (pure — no render-scope mutation).
    const priorValue = data.slice(0, i).reduce((s, x) => s + x.value, 0);
    const offset = (priorValue / total) * circ;
    return (
      <circle
        key={`${d.label}-${i}`}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={colorVars[i % colorVars.length]}
        strokeWidth={stroke}
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
      />
    );
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={centerLabel}
      >
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            className="stroke-muted"
            strokeWidth={stroke}
            opacity={0.4}
          />
          {segments}
        </g>
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          className="fill-foreground text-lg font-semibold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {centerLabel ?? "total"}
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={`${d.label}-${i}`} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: colorVars[i % colorVars.length] }}
              />
              <span dir="auto" className="text-muted-foreground">
                <AutoTranslate text={d.label} />
              </span>
              <span className="text-foreground font-medium tabular-nums">
                {d.value} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
