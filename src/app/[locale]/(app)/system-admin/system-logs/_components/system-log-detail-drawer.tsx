"use client";

import { Terminal, X, Copy, ListTree } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { systemLogsService } from "@/services/system-logs/system-logs.service";
import type { SystemLogEntry } from "@/services/system-logs/system-logs.types";
import { SystemLogLevelBadge } from "./system-log-level-badge";

interface SystemLogDetailDrawerProps {
  entryId: string | null;
  open: boolean;
  onClose: () => void;
}

const EMPTY = "—";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px]">{label}</span>
      <span className="text-foreground font-mono text-xs break-all">
        {value || EMPTY}
      </span>
    </div>
  );
}

/**
 * RIO-NFR-016 — the full record behind one row: message, stack, context, and
 * the correlation block.
 *
 * The request trace is the point of this drawer. A single error line rarely
 * explains itself; what does is "everything else that happened in the same
 * request". The backend stamps a request id on every log line
 * (common/logger/logger.config.ts), and `GET /system-logs/request/:id` is
 * what turns that into an answer — this is the only place in the app that
 * cashes it in.
 */
export function SystemLogDetailDrawer({
  entryId,
  open,
  onClose,
}: SystemLogDetailDrawerProps) {
  const t = useTranslations("systemAdmin.systemLogs.detail");
  const [entry, setEntry] = useState<SystemLogEntry | null>(null);
  const [failed, setFailed] = useState(false);
  const [trace, setTrace] = useState<SystemLogEntry[] | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  // State is written only from the promise callbacks — never synchronously
  // in the effect body, which would put this on React's cascading-render
  // path. "Loading" is therefore derived below rather than stored.
  useEffect(() => {
    if (!entryId || !open) return;
    let active = true;

    systemLogsService
      .getById(entryId)
      .then((res) => {
        if (!active) return;
        setEntry(res);
        setFailed(false);
        // A new entry belongs to a different request — drop any trace loaded
        // for the previous one rather than showing it under this entry.
        setTrace(null);
      })
      .catch(() => {
        if (!active) return;
        setEntry(null);
        setFailed(true);
        setTrace(null);
      });

    return () => {
      active = false;
    };
  }, [entryId, open]);

  /** True until the fetched entry is the one the caller asked for — covers
   *  both the first load and switching rows while a drawer is already open. */
  const loading = !failed && entry?.id !== entryId;

  const toggleTrace = () => {
    if (trace) {
      setTrace(null);
      return;
    }
    if (!entry?.requestId) return;
    setTraceLoading(true);
    systemLogsService
      .getByRequestId(entry.requestId)
      .then((items) => setTrace(items))
      .catch(() => setTrace([]))
      .finally(() => setTraceLoading(false));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="bg-background/70 absolute inset-0 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-label={t("title")}
        className="bg-background border-border relative flex h-full w-full max-w-xl flex-col border-l shadow-xl"
      >
        <header className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <Terminal className="text-primary size-4" />
            {t("title")}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("close")}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : failed || !entry ? (
            <p className="text-muted-foreground py-10 text-center text-xs">
              {t("loadFailed")}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SystemLogLevelBadge level={entry.level} />
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {entry.source}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-foreground text-sm break-words">{entry.message}</p>
              </div>

              <Card className="grid grid-cols-2 gap-3 p-3">
                <Field label={t("eventCode")} value={entry.eventCode} />
                <Field
                  label={t("endpoint")}
                  value={
                    entry.http.path
                      ? `${entry.http.method ?? ""} ${entry.http.path} ${
                          entry.http.statusCode ?? ""
                        }`.trim()
                      : null
                  }
                />
                <Field label={t("requestId")} value={entry.requestId} />
                <Field label={t("organization")} value={entry.organizationName} />
                <Field
                  label={t("actor")}
                  value={
                    entry.actor ? `${entry.actor.name} (${entry.actor.email})` : null
                  }
                />
                <Field label={t("ipAddress")} value={entry.ipAddress} />
                <Field label={t("instance")} value={entry.instanceId} />
                <Field label={t("userAgent")} value={entry.userAgent} />
              </Card>

              <section className="flex flex-col gap-1">
                <span className="text-muted-foreground text-[11px]">{t("stack")}</span>
                {entry.stack ? (
                  <pre className="bg-muted text-foreground max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
                    {entry.stack}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">{t("noStack")}</p>
                )}
              </section>

              <section className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-[11px]">
                    {t("context")}
                  </span>
                  {entry.context && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 text-[11px]"
                      onClick={() =>
                        void navigator.clipboard?.writeText(
                          JSON.stringify(entry.context, null, 2),
                        )
                      }
                    >
                      <Copy className="size-3" />
                      {t("copyJson")}
                    </Button>
                  )}
                </div>
                {entry.context ? (
                  <pre className="bg-muted text-foreground max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px]">
                    {JSON.stringify(entry.context, null, 2)}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">{t("noContext")}</p>
                )}
              </section>

              {entry.requestId && (
                <section className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1 text-xs"
                    onClick={toggleTrace}
                    disabled={traceLoading}
                  >
                    <ListTree className="size-3.5" />
                    {trace ? t("hideTrace") : t("viewTrace")}
                  </Button>

                  {trace && (
                    <div className="border-border flex flex-col gap-1 rounded-md border p-2">
                      <span className="text-muted-foreground text-[11px]">
                        {t("traceTitle")}
                      </span>
                      {trace.length === 0 ? (
                        <p className="text-muted-foreground text-xs">{t("traceEmpty")}</p>
                      ) : (
                        trace.map((row) => (
                          <div
                            key={row.id}
                            className={
                              row.id === entry.id
                                ? "bg-muted flex items-start gap-2 rounded p-1.5"
                                : "flex items-start gap-2 p-1.5"
                            }
                          >
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              {new Date(row.createdAt).toLocaleTimeString()}
                            </span>
                            <SystemLogLevelBadge level={row.level} />
                            <span className="text-foreground text-xs break-words">
                              {row.message}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
