import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  badge?: {
    text: string;
    variant?: "attention" | "ok" | "warning" | "neutral";
  };
  trend?: "up" | "down" | "flat";
  className?: string;
}

const BADGE_STYLES = {
  attention:
    "bg-amber-500/10 text-amber-600 border border-amber-500/30 dark:text-amber-400",
  ok: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400",
  warning: "bg-destructive/10 text-destructive border border-destructive/30",
  neutral: "bg-muted text-muted-foreground border border-border",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  badge,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group border-border/60 bg-card relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      {/* Subtle background accent */}
      <div className="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="relative flex flex-col gap-4">
        {/* Icon + Badge row */}
        <div className="flex items-start justify-between">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-6" />
          </div>
          {badge ? (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs leading-5 font-semibold",
                BADGE_STYLES[badge.variant ?? "neutral"],
              )}
            >
              {badge.text}
            </span>
          ) : null}
        </div>

        {/* Metric + Label */}
        <div>
          <p className="text-foreground text-4xl leading-none font-extrabold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="text-muted-foreground mt-2 text-base font-semibold">{label}</p>
          {description ? (
            <p className="text-muted-foreground/80 mt-1 text-sm font-medium">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
