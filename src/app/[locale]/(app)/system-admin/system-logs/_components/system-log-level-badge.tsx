"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SystemLogLevel } from "@/services/system-logs/system-logs.types";

/**
 * Severity is the first thing the eye should land on in a log table, so it
 * carries colour as well as text — but never colour alone: the level name is
 * always spelled out, so the row is still readable to anyone who can't
 * distinguish the hues.
 */
const LEVEL_CLASS: Record<SystemLogLevel, string> = {
  fatal: "bg-red-600 text-white border-transparent",
  error:
    "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  warn: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  info: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
};

export function SystemLogLevelBadge({ level }: { level: SystemLogLevel }) {
  const t = useTranslations("systemAdmin.systemLogs.levels");
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px] font-medium", LEVEL_CLASS[level])}
    >
      {t(level)}
    </Badge>
  );
}
