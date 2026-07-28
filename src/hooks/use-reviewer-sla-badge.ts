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

export interface ReviewerSlaBadgeState {
  count: number;
  /** Highest severity among the *unread* alerts — drives the bell's color
   * so a reviewer sees escalation (amber -> red) ahead of an actual breach,
   * not just a flat number. `null` when there's nothing unread. */
  severity: "breached" | "at_risk" | "pending" | null;
  /** The full last-fetched list (not just unread) — lets a combined
   * notifications dropdown call markReviewerSlaAlertsSeen directly on
   * "mark all as read" without a second fetch. */
  alerts: SlaAlert[];
  /** Recomputes unread state from localStorage immediately — call this right
   * after markReviewerSlaAlertsSeen, otherwise the badge only clears on the
   * next poll tick (which can be minutes away), making "mark all as read"
   * look like it did nothing. */
  refresh: () => void;
}

/** Unread Reviewer SLA alert count (+ severity) for the topbar/sidebar
 * badge — an alert is "unread" until the user has actually visited the
 * Alerts page while it was present (see markReviewerSlaAlertsSeen). Polls
 * at the same server-configured interval the Alerts page itself uses
 * (RIO-NFR-014). In-app only by design (RIO-FR-Add-04: client confirmed no
 * email channel is needed) — this poll + severity escalation is the whole
 * "fires ahead of breach" mechanism. */
export function useReviewerSlaBadge(): ReviewerSlaBadgeState {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<ReviewerSlaBadgeState>({
    count: 0,
    severity: null,
    alerts: [],
    refresh: () => undefined,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // load() needs to be callable on-demand (see refresh) as well as on its own
  // poll interval, so the effect stashes it here instead of only closing over it.
  const loadRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!userId) {
      Promise.resolve().then(() =>
        setState({ count: 0, severity: null, alerts: [], refresh: () => undefined }),
      );
      return;
    }
    const uid = userId;

    function load() {
      reviewerSlaService
        .listAlerts()
        .then((alerts) => {
          const seen = readSeenIds(uid);
          const unread = alerts.filter((a) => !seen.has(a.id));
          const severity: ReviewerSlaBadgeState["severity"] = unread.some(
            (a) => a.status === "breached",
          )
            ? "breached"
            : unread.some((a) => a.status === "at_risk")
              ? "at_risk"
              : unread.length > 0
                ? "pending"
                : null;
          setState({
            count: unread.length,
            severity,
            alerts,
            refresh: () => loadRef.current(),
          });
        })
        .catch(() => undefined);
    }

    loadRef.current = load;
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

  return state;
}
