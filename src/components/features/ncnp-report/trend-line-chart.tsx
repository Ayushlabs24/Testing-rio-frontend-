import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format-date";

export interface TrendAnnotation {
  /** Must match a point's `month` (YYYY-MM) exactly to render. */
  month: string;
  label: string;
}

interface TrendLineChartProps {
  points: Array<{ month: string; count: number }>;
  emptyText: string;
  locale: AppLocale;
  /**
   * Known-event markers (campaign launches, platform changes, ...) drawn as
   * a vertical line + label at the matching month. There is no structured
   * "events" data source anywhere in this platform today (no schema/table
   * for it) — this prop exists so the chart is ready for real annotations
   * the moment a source is decided (a curated config, or a future Events
   * table), without fabricating any in the meantime. Defaults to none.
   */
  annotations?: TrendAnnotation[];
}

export function TrendLineChart({
  points,
  emptyText,
  annotations = [],
  locale,
}: TrendLineChartProps) {
  if (points.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  const width = 600;
  const height = 140;
  const max = Math.max(1, ...points.map((p) => p.count));

  // A single month has no "trend" to draw a line across — plot the one
  // point against a real baseline/gridline instead of collapsing the line/
  // area math to a sliver at x=0 (stepX=0 with only one coordinate produces
  // a degenerate path), so it still reads as a chart, not a bare floating dot.
  if (points.length === 1) {
    const point = points[0]!;
    const baseline = height - 5;
    const cy = height - (point.count / max) * (height - 10) - 5;
    const cx = width / 2;
    return (
      <div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          preserveAspectRatio="none"
        >
          <line
            x1={0}
            x2={width}
            y1={height / 2}
            y2={height / 2}
            className="stroke-border"
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={width}
            y1={baseline}
            y2={baseline}
            className="stroke-muted-foreground/40"
            strokeWidth={1}
          />
          <line
            x1={cx}
            x2={cx}
            y1={baseline}
            y2={cy}
            className="stroke-chart-1"
            strokeWidth={2}
          />
          <circle cx={cx} cy={cy} r={6} className="fill-chart-1" />
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            className="fill-foreground text-[13px] font-bold"
          >
            {formatNumber(point.count, locale)}
          </text>
        </svg>
        <p className="text-muted-foreground mt-1 text-center text-xs">{point.month}</p>
      </div>
    );
  }

  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: height - (p.count / max) * (height - 10) - 5,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]?.x ?? 0},${height} L0,${height} Z`;
  const xByMonth = new Map(points.map((p, i) => [p.month, coords[i]?.x ?? 0]));

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        <path d={areaPath} className="fill-chart-1/10" />
        <path d={linePath} fill="none" className="stroke-chart-1" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle
            key={points[i]?.month}
            cx={c.x}
            cy={c.y}
            r={3}
            className="fill-chart-1"
          />
        ))}
        {annotations
          .filter((a) => xByMonth.has(a.month))
          .map((a) => (
            <g key={a.month}>
              <line
                x1={xByMonth.get(a.month)}
                x2={xByMonth.get(a.month)}
                y1={0}
                y2={height}
                className="stroke-muted-foreground/40"
                strokeDasharray="3,3"
              />
              <title>{a.label}</title>
            </g>
          ))}
      </svg>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>{points[0]?.month}</span>
        <span>{points[points.length - 1]?.month}</span>
      </div>
    </div>
  );
}
