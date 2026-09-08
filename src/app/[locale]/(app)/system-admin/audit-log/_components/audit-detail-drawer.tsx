"use client";

import { Shield, X, User, Building2, Tag, Key, Monitor, Lock } from "lucide-react";
import { FormattedDate } from "@/components/common/formatted-date";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";

interface AuditEventDetail {
  id: string;
  organizationId: string | null;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  changes?: { field: string; before: unknown; after: unknown }[];
  metadata?: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Rendered for a value that was not set — e.g. the "before" of a creation. */
const EMPTY_VALUE = "—";

/**
 * Audit values arrive as whatever the recording service passed: strings,
 * numbers, booleans, null, or the occasional object. `JSON.stringify` was
 * being used for all of them, which rendered a plain string as `"draft"`
 * (with quotes) and an absent value as the literal text `null` — both read as
 * noise in a screen an auditor is scanning. Primitives are printed as-is,
 * absent values become an em dash, and only genuinely structured values fall
 * back to JSON.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

interface AuditDetailDrawerProps {
  eventId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AuditDetailDrawer({ eventId, open, onClose }: AuditDetailDrawerProps) {
  const t = useTranslations("systemAdmin.auditLog.drawer");
  const [data, setData] = useState<AuditEventDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!eventId || !open) return;

    apiClient
      .get<AuditEventDetail>(`/audit/${eventId}`)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [eventId, open]);

  if (!open) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-background border-border flex h-full w-full max-w-2xl flex-col justify-between overflow-y-auto border-l p-6 shadow-2xl">
        <div>
          <div className="border-border flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
                <Shield className="text-primary size-5" />
                {t("title")}
              </h2>
              <p className="text-muted-foreground mt-0.5 font-mono text-xs">{eventId}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("close")}>
              <X className="size-5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : data ? (
            <div className="space-y-6 pt-4">
              {/* Event Header Banner */}
              <div className="border-primary/20 bg-primary/5 flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Badge variant="outline" className="mb-1 font-mono text-xs uppercase">
                    {data.action}
                  </Badge>
                  <h3 className="text-foreground text-sm font-semibold">
                    {data.entityLabel}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {data.entityType} {data.entityId ? `(${data.entityId})` : ""}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <span className="text-muted-foreground block">{t("timestamp")}</span>
                  <span className="text-foreground font-mono font-medium">
                    <FormattedDate value={data.createdAt} withTime />
                  </span>
                </div>
              </div>

              {/* Actor & Org Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <User className="size-3.5" />
                    <span>{t("actor")}</span>
                  </div>
                  <p className="text-foreground font-semibold">
                    {data.actor?.name ?? t("systemActor")}
                  </p>
                  {data.actor?.email ? (
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {data.actor.email}
                    </p>
                  ) : null}
                </Card>

                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <Building2 className="size-3.5" />
                    <span>{t("organization")}</span>
                  </div>
                  <p className="text-foreground font-mono font-medium">
                    {data.organizationId ?? t("globalScope")}
                  </p>
                </Card>
              </div>

              {/* IP & UA Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <Monitor className="size-3.5" />
                    <span>{t("ipAddress")}</span>
                  </div>
                  <p className="text-foreground font-mono font-medium">
                    {data.ipAddress ?? "127.0.0.1"}
                  </p>
                </Card>

                <Card className="p-3">
                  <div className="text-muted-foreground mb-1 flex items-center gap-2">
                    <Lock className="size-3.5 text-amber-500" />
                    <span>{t("userAgent")}</span>
                  </div>
                  <p
                    className="text-muted-foreground truncate font-mono text-[11px]"
                    title={data.userAgent ?? undefined}
                  >
                    {data.userAgent ?? t("internalSystem")}
                  </p>
                </Card>
              </div>

              {/* State Changes */}
              {data.changes && data.changes.length > 0 ? (
                <div>
                  <h4 className="text-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                    <Tag className="text-primary size-3.5" />
                    {t("changes")}
                  </h4>
                  <div className="space-y-2">
                    {data.changes.map((c, idx) => (
                      <div
                        key={idx}
                        className="border-border bg-muted/20 rounded border p-2.5 text-xs"
                      >
                        <span className="text-primary mb-1 block font-mono font-bold">
                          {c.field}
                        </span>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-destructive/10 text-destructive rounded p-1.5 font-mono break-words">
                            <span className="text-muted-foreground mb-0.5 block text-[9px] uppercase">
                              {t("changeFrom")}
                            </span>
                            {formatValue(c.before)}
                          </div>
                          <div className="rounded bg-emerald-500/10 p-1.5 font-mono break-words text-emerald-600 dark:text-emerald-400">
                            <span className="text-muted-foreground mb-0.5 block text-[9px] uppercase">
                              {t("changeTo")}
                            </span>
                            {formatValue(c.after)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Metadata JSON */}
              {data.metadata ? (
                <div>
                  <h4 className="text-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold">
                    <Key className="text-primary size-3.5" />
                    {t("metadata")}
                  </h4>
                  <pre className="bg-muted text-foreground border-border overflow-x-auto rounded-lg border p-3 font-mono text-[11px]">
                    {JSON.stringify(data.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-border flex justify-end border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
