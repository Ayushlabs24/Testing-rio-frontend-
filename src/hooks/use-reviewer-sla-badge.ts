import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { reviewerSlaService } from "@/services/reviewer-sla/reviewer-sla.service";
import type { SlaAlert } from "@/services/reviewer-sla/reviewer-sla.types";

function seenKey(userId: string): string {
  // User-scoped, not global — a shared machine where one account logs out
  // and another logs in must not leak one user's "seen" state onto another.
  return `rio.reviewerSla.seenIds.${userId}`;
}

function readSeenIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Marks the given alert ids as seen for the current user — call this once
 * the Reviewer SLA Alerts page has actually rendered them. */
export function markReviewerSlaAlertsSeen(userId: string, alerts: SlaAlert[]): void {
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(alerts.map((a) => a.id)));
  } catch {
    // Non-fatal — localStorage can throw in private-browsing/quota-exceeded
    // cases; the badge just won't clear on this device, nothing breaks.
  }
}

/** Unread Reviewer SLA alert count for the topbar/sidebar badge — an alert
 * is "unread" until the user has actually visited the Alerts page while it
 * was present (see markReviewerSlaAlertsSeen). Polls at the same
 * server-configured interval the Alerts page itself uses (RIO-NFR-014). */
export function useReviewerSlaBadge(): number {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) {
      Promise.resolve().then(() => setCount(0));
      return;
    }
    const uid = userId;

    function load() {
      reviewerSlaService
        .listAlerts()
        .then((alerts) => {
          const seen = readSeenIds(uid);
          setCount(alerts.filter((a) => !seen.has(a.id)).length);
        })
        .catch(() => undefined);
    }

    load();
    reviewerSlaService
      .getConfig()
      .then((config) => {
        intervalRef.current = setInterval(load, config.pollIntervalMs);
      })
      .catch(() => undefined);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  return count;
}
