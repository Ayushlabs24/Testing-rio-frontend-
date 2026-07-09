const SESSION_KEY = "rio.session";

interface StoredSession {
  token: string;
  userId: string;
}

/**
 * Client-side session persistence, standing in for a real httpOnly session
 * cookie until a backend exists. Only ever touched from inside
 * `src/services/auth/auth.service.ts` — nothing else should read/write this.
 */
export const mockSession = {
  save(session: StoredSession) {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },
  read(): StoredSession | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(SESSION_KEY);
  },
};
