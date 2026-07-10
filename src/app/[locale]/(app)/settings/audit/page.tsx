"use client";

import { History, Lock, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTIONS, type AuditAction } from "@/config/audit";
import { auditService } from "@/services/audit/audit.service";
import type { AuditEvent } from "@/services/audit/audit.types";
import { ChangeDetailsDialog } from "./change-details-dialog";

/** Badge tone per action — keeps destructive/approval events visually distinct. */
const ACTION_VARIANT: Record<
  AuditAction,
  "default" | "secondary" | "outline" | "destructive"
> = {
  create: "secondary",
  edit: "outline",
  approve: "default",
  share: "default",
  delete: "destructive",
};

const ALL = "all";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AuditSettingsPage() {
  const t = useTranslations("app.settings.audit");
  const tActions = useTranslations("app.settings.audit.actions");
  const tEntities = useTranslations("app.settings.audit.entities");
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<AuditAction | typeof ALL>(ALL);

  useEffect(() => {
    auditService.list().then(setEvents);
  }, []);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (events ?? []).filter((event) => {
      if (action !== ALL && event.action !== action) return false;
      if (!normalized) return true;
      return (
        (event.actor?.name.toLowerCase().includes(normalized) ?? false) ||
        (event.actor?.email.toLowerCase().includes(normalized) ?? false) ||
        event.entityLabel.toLowerCase().includes(normalized)
      );
    });
  }, [events, query, action]);

  return (
    <PermissionGuard module="audit" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <Search className="text-muted-foreground size-4" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <Select
                value={action}
                onValueChange={(value) => setAction(value as AuditAction | typeof ALL)}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-44"
                  aria-label={t("filterLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterAll")}</SelectItem>
                  {AUDIT_ACTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tActions(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-56">{t("dateColumn")}</TableHead>
                  <TableHead>{t("actorColumn")}</TableHead>
                  <TableHead className="w-32">{t("actionColumn")}</TableHead>
                  <TableHead>{t("targetColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="bg-muted h-4 w-40 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-muted size-8 rounded-full" />
                          <div className="bg-muted h-4 w-28 rounded" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="bg-muted h-5 w-16 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="bg-muted h-4 w-36 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <History className="size-5" />
                        </div>
                        <p>{t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-muted-foreground align-top text-sm tabular-nums">
                        {formatTimestamp(event.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs font-medium">
                              {event.actor ? initials(event.actor.name) : "SYS"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-foreground text-sm font-medium">
                              {event.actor?.name ?? t("systemActor")}
                            </p>
                            {event.actor ? (
                              <p className="text-muted-foreground text-xs">
                                {event.actor.email}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[event.action]}>
                          {tActions(event.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-foreground text-sm">
                              {event.entityLabel}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {tEntities(event.entityType)}
                            </span>
                          </div>
                          {event.changes && event.changes.length > 0 ? (
                            <ChangeDetailsDialog
                              changes={event.changes}
                              entityLabel={event.entityLabel}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock className="size-3" />
          {t("immutableNotice")}
        </p>
      </PageContainer>
    </PermissionGuard>
  );
}
