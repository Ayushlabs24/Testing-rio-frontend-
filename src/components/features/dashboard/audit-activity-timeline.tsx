"use client";

import {
  Activity,
  Archive,
  Bot,
  CheckCircle2,
  FileText,
  Share2,
  UploadCloud,
  Users2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { isEntityLabelTranslatable } from "@/config/audit";
import { Link } from "@/i18n/navigation";
import { apiClient } from "@/services/api/client";
import type { AuditEvent } from "@/services/audit/audit.types";

/* ─── Icon mapping per action category ─────────────────────────────────── */
function getActivityIcon(action: string): React.ReactNode {
  const a = action.toLowerCase();
  if (a.includes("share") || a.includes("sharing"))
    return <Share2 className="size-3.5 text-blue-500" />;
  if (a.includes("report")) return <FileText className="size-3.5 text-amber-500" />;
  if (a.includes("ai") || a.includes("classif") || a.includes("quality"))
    return <Bot className="size-3.5 text-purple-500" />;
  if (a.includes("archive") || a.includes("restore"))
    return <Archive className="size-3.5 text-cyan-500" />;
  if (a.includes("user") || a.includes("role") || a.includes("member"))
    return <Users2 className="size-3.5 text-rose-500" />;
  if (a.includes("survey") || a.includes("response") || a.includes("upload"))
    return <UploadCloud className="size-3.5 text-emerald-500" />;
  if (a.includes("approved") || a.includes("published"))
    return <CheckCircle2 className="size-3.5 text-emerald-500" />;
  return <Activity className="text-muted-foreground size-3.5" />;
}

/* ─── Human-readable relative time ─────────────────────────────────────── */
function formatRelativeTime(
  iso: string,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return t("timeMinsAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("timeHrsAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  return t("timeDaysAgo", { count: days });
}

/* ─── Human-friendly label from action enum ────────────────────────────── */
// Bug found in the 2026-09-08 bilingual audit (the exact defect a reported
// screenshot showed: "Login"/"Logout"/"... Admin Viewed Organization Users"
// staying in English on an otherwise-Arabic dashboard) — this used to just
// title-case the raw action code instead of resolving it through the same
// `app.settings.audit.actions` dictionary the full Audit Log page already
// uses. Same graceful-fallback shape as that page's own `formatAuditActionLabel`.
function formatAction(action: string, tActions: (key: string) => string): string {
  try {
    const translated = tActions(action);
    if (translated && !translated.startsWith("app.settings.audit.actions.")) {
      return translated;
    }
  } catch {
    // fall through to the title-cased fallback below
  }
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AuditActivityTimelineProps {
  limit?: number;
  className?: string;
}

export function AuditActivityTimeline({
  limit = 8,
  className,
}: AuditActivityTimelineProps) {
  const t = useTranslations("systemAdmin.dashboard");
  const tActions = useTranslations("app.settings.audit.actions");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ items: AuditEvent[]; total: number }>(`/audit?limit=${limit}&offset=0`)
      .then((res) => setEvents(res.items ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground text-base font-bold">
          {t("latestAuditActivity")}
        </h3>
        <Link
          href="/system-admin/audit-log"
          className="text-primary hover:text-primary/80 text-sm font-semibold transition-colors"
        >
          {t("fullHistory")}
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="bg-muted size-8 shrink-0 animate-pulse rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="bg-muted h-3.5 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {t("noActivity")}
        </p>
      ) : (
        <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="hover:bg-muted/40 group flex gap-3 rounded-xl px-2.5 py-3 transition-colors"
            >
              {/* Icon */}
              <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                {getActivityIcon(ev.action)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm leading-snug font-semibold">
                  {formatAction(ev.action, tActions)}
                  {ev.entityLabel ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      —{" "}
                      {isEntityLabelTranslatable(ev.entityType) ? (
                        <AutoTranslate text={ev.entityLabel} />
                      ) : (
                        ev.entityLabel
                      )}
                    </span>
                  ) : null}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {ev.actor ? (
                    <span className="text-muted-foreground truncate font-medium">
                      <AutoTranslate text={ev.actor.name} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium">
                      {t("actorSystem")}
                    </span>
                  )}
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground/70 shrink-0 font-medium tabular-nums">
                    {formatRelativeTime(ev.createdAt, t)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
