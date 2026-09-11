"use client";

import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { isEntityLabelTranslatable, type AuditEntityType } from "@/config/audit";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/services/api/client";

const LIMIT = 15;

interface AuditItem {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityLabel: string;
  createdAt: string;
}

interface AuditListResponse {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
}

// Bug found in the 2026-09-08 bilingual audit (fourth independent copy of
// this exact class of bug — dashboard widget, System Admin Audit Log page,
// and this org-level tab all had their own hand-rolled formatter that never
// consulted i18n at all). Resolves through the same `app.settings.audit.
// actions` dictionary everywhere else does, falling back to title-casing
// only when a label is genuinely missing.
function formatActionLabel(action: string, tActions: (key: string) => string): string {
  try {
    const translated = tActions(action);
    if (translated && !translated.startsWith("app.settings.audit.actions.")) {
      return translated;
    }
  } catch {
    // fall through to the title-cased fallback below
  }
  return action
    .replace(/^SYSTEM_ADMIN_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface OrgAuditHistoryTabProps {
  organizationId: string;
}

export function OrgAuditHistoryTab({ organizationId }: OrgAuditHistoryTabProps) {
  const t = useTranslations("systemAdmin.auditLog");
  const tActions = useTranslations("app.settings.audit.actions");
  const tEntities = useTranslations("app.settings.audit.entities");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const loadEvents = useCallback(() => {
    if (!organizationId) return;
    const requestId = ++requestRef.current;
    apiClient
      .get<AuditListResponse>("/audit", {
        params: { organizationId, limit: LIMIT, offset },
      })
      .then((res) => {
        if (requestId !== requestRef.current) return;
        setItems(res?.items ?? []);
        setTotal(res?.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== requestRef.current) return;
        setItems([]);
        setTotal(0);
        setLoading(false);
      });
  }, [organizationId, offset]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 py-4">
        <Shield className="text-primary size-5" />
        <CardTitle className="text-base font-semibold">
          {t("title")} ({total})
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.timestamp")}</TableHead>
              <TableHead>{t("columns.actor")}</TableHead>
              <TableHead>{t("columns.action")}</TableHead>
              <TableHead>{t("columns.entity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex justify-center">
                    <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                    <FormattedDate value={item.createdAt} withTime />
                  </TableCell>
                  <TableCell className="text-foreground text-xs font-medium">
                    {item.actor ? (
                      <div>
                        <span>
                          <AutoTranslate text={item.actor.name} />
                        </span>
                        <span className="text-muted-foreground block font-mono text-[10px]">
                          {item.actor.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">
                        {t("systemActor")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      {formatActionLabel(item.action, tActions)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="text-foreground block font-semibold break-words">
                      {isEntityLabelTranslatable(item.entityType as AuditEntityType) ? (
                        <AutoTranslate text={item.entityLabel} />
                      ) : (
                        item.entityLabel
                      )}
                    </span>
                    <span className="text-muted-foreground block font-mono text-[10px] capitalize">
                      {tEntities.has(item.entityType)
                        ? tEntities(item.entityType)
                        : item.entityType}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {total > 0 ? (
          <div className="border-border flex items-center justify-between border-t px-4 py-3 text-xs">
            <span className="text-muted-foreground font-mono">
              {t("paginationShowing", {
                start: offset + 1,
                end: Math.min(offset + LIMIT, total),
                total,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                <ChevronLeft className="mr-1 size-3.5" />
                {t("previous")}
              </Button>
              <span className="text-muted-foreground font-mono">
                {t("paginationPage", { current: currentPage, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setOffset(offset + LIMIT)}
              >
                {t("next")}
                <ChevronRight className="ml-1 size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
