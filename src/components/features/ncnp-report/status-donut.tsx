import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format-date";

interface DonutSegment {
  label: string;
  count: number;
  // A CSS custom property name (e.g. "--chart-1", "--destructive") for
  // semantic/status colors, OR a literal color (e.g. a validated
  // categorical hex) for breakdowns like Gender where adjacent --chart-N
  // tokens read too similar to tell apart — anything not starting with
  // "--" is used as-is instead of wrapped in var().
  colorVar: string;
}

interface StatusDonutProps {
  segments: DonutSegment[];
  centerLabel: string;
  locale: AppLocale;
}

function resolveColor(colorVar: string): string {
  return colorVar.startsWith("--") ? `var(${colorVar})` : colorVar;
}

export function StatusDonut({ segments, centerLabel, locale }: StatusDonutProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  let cursor = 0;
  const stops = segments.map((s) => {
    const start = total === 0 ? 0 : (cursor / total) * 100;
    cursor += s.count;
    const end = total === 0 ? 0 : (cursor / total) * 100;
    return `${resolveColor(s.colorVar)} ${start}% ${end}%`;
  });

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative size-40 shrink-0 rounded-full"
        style={{
          background:
            total === 0 ? "var(--muted)" : `conic-gradient(${stops.join(", ")})`,
        }}
      >
        <div className="bg-card absolute inset-7 flex flex-col items-center justify-center rounded-full px-2 text-center">
          <span className="text-foreground text-2xl font-bold tabular-nums">
            {formatNumber(total, locale)}
          </span>
          <span className="text-muted-foreground mt-0.5 text-[9px] leading-tight tracking-wide uppercase">
            {centerLabel}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: resolveColor(s.colorVar) }}
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
