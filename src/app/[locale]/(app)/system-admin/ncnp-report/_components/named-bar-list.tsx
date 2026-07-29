import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NamedBarListItem {
  id: string;
  name: string;
  count: number;
}

interface NamedBarListProps {
  items: NamedBarListItem[];
  limit?: number;
  emptyText: string;
  /**
   * Called with (shownCount, totalCount) to render a disclosure caption
   * ("Showing 5 of 24") whenever the list is actually truncated — omit
   * (or return undefined) to render nothing. Every truncated list in this
   * report must disclose how much is hidden, not just the ones that
   * happen to be long — this was a specific client finding on the
   * previous mockup (inconsistent truncation labeling).
   */
  formatCaption?: (shown: number, total: number) => string;
}

// Plain div/Tailwind bars — this codebase has no charting library dependency
// (see GeographicDistribution's react-leaflet map for the one exception,
// which is a real map, not a chart), so every bar/donut in this report is
// built the same way as the rest of the app's dataviz: div width percentages
// and CSS conic-gradient, not an added dependency.
export function NamedBarList({
  items,
  limit = 5,
  emptyText,
  formatCaption,
}: NamedBarListProps) {
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((i) => i.count));

  if (shown.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div>
        <div className="space-y-2.5">
          {shown.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground w-32 shrink-0 truncate text-right text-sm">
                    {item.name}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-wrap">
                  {item.name}
                </TooltipContent>
              </Tooltip>
              <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-chart-1 h-full rounded-full"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className="text-foreground w-14 shrink-0 text-sm font-semibold tabular-nums">
                {item.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        {formatCaption && shown.length < items.length ? (
          <p className="text-muted-foreground mt-3 text-xs italic">
            {formatCaption(shown.length, items.length)}
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
