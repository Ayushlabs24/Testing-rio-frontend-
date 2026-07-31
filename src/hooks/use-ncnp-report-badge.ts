import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import {
  ncnpReportReviewService,
  type NcnpReportReviewAlert,
} from "@/services/ncnp-report-review/ncnp-report-review.service";

// Same fixed-interval-poll + user-scoped localStorage seen-ids pattern as
// use-sharing-notifications.ts — this endpoint is deliberately NOT an
// extension of use-reviewer-sla-badge.ts's reviewerSlaService, since that
// service is gated on surveyBuilder:read (a permission System Reviewer
// never holds — see ncnp-report-review.controller.ts's own comment).
const POLL_INTERVAL_MS = 30_000;

function seenKey(userId: string): string {
  return `rio.ncnpReport.seenIds.${userId}`;
}

function readSeenIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(Array.from(ids)));
  } catch {
    // Non-fatal — localStorage can throw in private-browsing/quota-exceeded
    // cases; the badge just won't clear on this device, nothing breaks.
  }
}

export interface NcnpReportBadgeState {
  alerts: NcnpReportReviewAlert[];
  unreadCount: number;
  markAllSeen: () => void;
  /** Re-fetches immediately instead of waiting for the poll interval — call
   * this after an action that could change the alert list (approve/reject/
   * publish/generate happen in a completely different component tree, e.g.
   * the report detail page, with no other link back to this hook's state).
   * Same fix already applied to the Reviewer SLA badge for the same reason. */
  refresh: () => void;
}

/** Unread NCNP Compiled Report review alert count for the topbar bell —
 * "System Reviewer: reports awaiting your decision" / "System Admin:
 * reports ready to publish", depending on the caller's own role (the
 * backend branches this for us — see NcnpReportReviewService.listAlerts). */
export function useNcnpReportBadge(): NcnpReportBadgeState {
  const { session } = useAuth();
  const userId = session?.user.id;
  const canAccess = usePermission("ncnpReport", "read");
  const [alerts, setAlerts] = useState<NcnpReportReviewAlert[]>([]);
  const [, setSeenVersion] = useState(0);
  const seenIds = userId ? readSeenIds(userId) : new Set<string>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // load() needs to be callable on-demand (see refresh) as well as on its own
  // poll interval, so the effect stashes it here instead of only closing over it.
  const loadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!userId || !canAccess) return;

    function load() {
      ncnpReportReviewService
        .listAlerts()
        .then(setAlerts)
        .catch(() => undefined);
    }

    loadRef.current = load;
    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId, canAccess]);

  function markAllSeen() {
    if (!userId) return;
    const next = readSeenIds(userId);
    for (const alert of alerts) next.add(alert.id);
    writeSeenIds(userId, next);
    setSeenVersion((v) => v + 1);
  }

  function refresh() {
    loadRef.current();
  }

  const unreadCount = alerts.filter((a) => !seenIds.has(a.id)).length;

  return { alerts, unreadCount, markAllSeen, refresh };
}
