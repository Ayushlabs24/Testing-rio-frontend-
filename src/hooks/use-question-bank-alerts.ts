import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { questionBankAlertsService } from "@/services/question-bank-alerts/question-bank-alerts.service";
import type { QuestionBankAlert } from "@/services/question-bank-alerts/question-bank-alerts.types";

// Same user-scoped localStorage seen-ids pattern as
// use-sharing-notifications.ts / use-reviewer-sla-badge.ts. The backend
// already restricts this feed to human_reviewer/system_reviewer (see
// QuestionBankAlertsService) — any other role gets an empty array back, so
// this hook needs no role check of its own.
const POLL_INTERVAL_MS = 30_000;

function seenKey(userId: string): string {
  return `rio.questionBankAlerts.seenIds.${userId}`;
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

export type QuestionBankNotification = QuestionBankAlert & { seen: boolean };

export interface QuestionBankAlertsState {
  notifications: QuestionBankNotification[];
  unreadCount: number;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
}

export function useQuestionBankAlerts(): QuestionBankAlertsState {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [alerts, setAlerts] = useState<QuestionBankAlert[]>([]);
  const [, setSeenVersion] = useState(0);
  const seenIds = userId ? readSeenIds(userId) : new Set<string>();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    function load() {
      questionBankAlertsService
        .listAlerts()
        .then(setAlerts)
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
