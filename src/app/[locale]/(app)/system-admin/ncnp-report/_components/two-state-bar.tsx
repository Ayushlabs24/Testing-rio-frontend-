interface TwoStateBarProps {
  primaryLabel: string;
  primaryCount: number;
  secondaryLabel: string;
  secondaryCount: number;
}

// A donut/pie is the wrong chart for a two-category, heavily skewed split
// (client feedback on Study Status: 96%/4% Active/Archived) — a thin
// single-row bar communicates it faster than a near-solid-color ring.
export function TwoStateBar({
  primaryLabel,
  primaryCount,
  secondaryLabel,
  secondaryCount,
}: TwoStateBarProps) {
  const total = primaryCount + secondaryCount;
  const primaryPct = total === 0 ? 0 : (primaryCount / total) * 100;
  const secondaryPct = total === 0 ? 0 : 100 - primaryPct;

  return (
    <div>
      <div className="bg-muted flex h-4 w-full overflow-hidden rounded-full">
        {primaryCount > 0 ? (
          <div className="bg-chart-2 h-full" style={{ width: `${primaryPct}%` }} />
        ) : null}
        {secondaryCount > 0 ? (
          <div className="bg-chart-1 h-full" style={{ width: `${secondaryPct}%` }} />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="bg-chart-2 size-2.5 rounded-sm" />
          <span className="text-muted-foreground">{primaryLabel}</span>
          <span className="text-foreground font-semibold tabular-nums">
            {primaryCount.toLocaleString()} · {primaryPct.toFixed(0)}%
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-chart-1 size-2.5 rounded-sm" />
          <span className="text-muted-foreground">{secondaryLabel}</span>
          <span className="text-foreground font-semibold tabular-nums">
            {secondaryCount.toLocaleString()} · {secondaryPct.toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
}
