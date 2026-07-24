"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authService } from "@/services/auth/auth.service";
import type { SessionContext } from "@/services/auth/auth.types";

interface AuthContextValue {
  session: SessionContext | null;
  /** True only while the initial session lookup (on mount) is in flight. */
  isLoading: boolean;
  setSession: (session: SessionContext) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((context) => {
        if (!cancelled) setSessionState(context);
      })
      .catch(() => {
        if (!cancelled) setSessionState(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      setSession: setSessionState,
      logout: async () => {
        await authService.logout();
        // The backend clears rio_session/rio_csrf itself (see
        // AuthController#logout), but per-user client-side caches (reviewer
        // SLA / sharing "seen alert" ids — see use-reviewer-sla-badge.ts,
        // use-sharing-notifications.ts) live in localStorage and are never
        // otherwise cleared, so they'd persist into a next session in the
        // same browser (e.g. a different account signing in right after).
        if (typeof window !== "undefined") {
          window.localStorage.clear();
          window.sessionStorage.clear();
        }
        setSessionState(null);
      },
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
