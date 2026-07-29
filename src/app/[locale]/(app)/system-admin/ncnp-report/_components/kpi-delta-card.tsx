import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NcnpPeriodStat } from "@/services/ncnp-report/ncnp-report.types";

interface KpiDeltaCardProps {
  label: string;
  total: number;
  stat: NcnpPeriodStat;
  periodLabel: string;
}

// changePct is null only when the prior period had zero — an undefined
// percentage, never rendered as "+100%"/"+Infinity%", which would
// misrepresent a 0-to-N change as something it isn't.
export function KpiDeltaCard({ label, total, stat, periodLabel }: KpiDeltaCardProps) {
  const direction =
    stat.changePct === null
      ? null
      : stat.changePct > 0
        ? "up"
        : stat.changePct < 0
          ? "down"
          : "flat";
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div className="border-border/60 bg-card rounded-2xl border p-6 shadow-sm">
      <p className="text-foreground text-4xl leading-none font-extrabold tracking-tight tabular-nums">
        {total.toLocaleString()}
      </p>
      <p className="text-muted-foreground mt-2 text-base font-semibold">{label}</p>
      <div className="mt-3 flex items-center gap-1.5 text-sm">
        <span
          className={cn(
            "flex items-center gap-1 font-semibold tabular-nums",
            direction === "up" && "text-success",
            direction === "down" && "text-destructive",
            direction === null || direction === "flat" ? "text-muted-foreground" : "",
          )}
        >
          <Icon className="size-3.5" />
          {stat.changePct === null
            ? "New"
            : `${stat.changePct > 0 ? "+" : ""}${stat.changePct.toFixed(1)}%`}
        </span>
        <span className="text-muted-foreground/80">{periodLabel}</span>
      </div>
    </div>
  );
}
