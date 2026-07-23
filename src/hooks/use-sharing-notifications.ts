import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { sharingAlertsService } from "@/services/sharing-alerts/sharing-alerts.service";
import type { SharingAlert } from "@/services/sharing-alerts/sharing-alerts.types";

// Same user-scoped localStorage seen-ids pattern as
// use-reviewer-sla-badge.ts, adapted for a per-item dropdown instead of a
// single "visited the page, mark everything seen" action: each alert can be
// marked seen individually (on click) as well as all at once.
const POLL_INTERVAL_MS = 30_000;

function seenKey(userId: string): string {
  return `rio.sharingAlerts.seenIds.${userId}`;
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

export interface SharingNotification extends SharingAlert {
  seen: boolean;
}

export interface SharingNotificationsState {
  notifications: SharingNotification[];
  unreadCount: number;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
}

export function useSharingNotifications(): SharingNotificationsState {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [alerts, setAlerts] = useState<SharingAlert[]>([]);
  // Read directly from localStorage on each render instead of mirroring it
  // into its own effect-driven state — avoids a setState-in-effect purely
  // to seed state from an external source, and markSeen/markAllSeen bump
  // `seenVersion` to force the next render to re-read the updated value.
  const [, setSeenVersion] = useState(0);
  const seenIds = userId ? readSeenIds(userId) : new Set<string>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    function load() {
      sharingAlertsService
        .listAlerts()
        // Study-sharing's own tab is currently hidden from the Sharing page
        // (UI-only decision — its backend/data is untouched) — a study
        // alert would otherwise deep-link to a tab that no longer renders,
        // so it's filtered out here rather than in the backend endpoint.
        .then((next) => setAlerts(next.filter((alert) => alert.entity !== "study")))
        .catch(() => undefined);
    }

    load();
    intervalRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userId]);

  function markSeen(id: string) {
    if (!userId) return;
    const next = readSeenIds(userId);
    next.add(id);
    writeSeenIds(userId, next);
    setSeenVersion((v) => v + 1);
  }

  function markAllSeen() {
    if (!userId) return;
    const next = readSeenIds(userId);
    for (const alert of alerts) next.add(alert.id);
    writeSeenIds(userId, next);
    setSeenVersion((v) => v + 1);
  }

  const notifications = alerts.map((alert) => ({
    ...alert,
    seen: seenIds.has(alert.id),
  }));
  const unreadCount = notifications.filter((n) => !n.seen).length;

  return { notifications, unreadCount, markSeen, markAllSeen };
}
