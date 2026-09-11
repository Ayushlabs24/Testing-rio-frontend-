import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format-date";

interface PieSlice {
  label: string;
  count: number;
  color: string; // any valid CSS color, e.g. "var(--chart-1)" or a literal hex
}

interface PieChartProps {
  slices: PieSlice[];
  locale: AppLocale;
}

// A plain conic-gradient pie (no center cutout, unlike StatusDonut) — same
// no-dependency dataviz convention as the rest of this report, offered as a
// distinct chart shape from the donut/bar so not every breakdown on the page
// looks identical.
export function PieChart({ slices, locale }: PieChartProps) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  let cursor = 0;
  const stops = slices.map((s) => {
    const start = total === 0 ? 0 : (cursor / total) * 100;
    cursor += s.count;
    const end = total === 0 ? 0 : (cursor / total) * 100;
    return `${s.color} ${start}% ${end}%`;
  });

  return (
    <div className="flex items-center gap-5">
      <div
        className="size-32 shrink-0 rounded-full"
        style={{
          background:
            total === 0 ? "var(--muted)" : `conic-gradient(${stops.join(", ")})`,
        }}
      />
      <div className="flex flex-col gap-1.5 text-sm">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground ml-auto pl-3 font-semibold tabular-nums">
              {formatNumber(s.count, locale)}
              {total > 0 ? ` · ${Math.round((s.count / total) * 100)}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
