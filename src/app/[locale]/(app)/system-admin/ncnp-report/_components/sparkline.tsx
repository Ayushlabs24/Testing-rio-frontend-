interface SparklineProps {
  points: number[];
  className?: string;
}

// A minimal inline trend line for a KPI number — no axes, no gridlines, just
// enough shape to say "this is the recent trend" beside a headline stat.
// Distinct from TrendLineChart, which is a full annotated chart in its own
// section; this is meant to sit next to a number, not replace that chart.
export function Sparkline({ points, className }: SparklineProps) {
  if (points.length < 2) return null;

  const width = 120;
  const height = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: height - ((p - min) / range) * (height - 4) - 2,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const last = coords[coords.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? "h-8 w-28"}
      preserveAspectRatio="none"
    >
      <path
        d={linePath}
        fill="none"
        className="stroke-chart-1"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r={2.5} className="fill-chart-1" />
    </svg>
  );
}
