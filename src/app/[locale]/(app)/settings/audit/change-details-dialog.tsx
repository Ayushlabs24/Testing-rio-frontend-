"use client";

import { ArrowRight, Eye, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormattedDate } from "@/components/common/formatted-date";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AuditActor, AuditFieldChange } from "@/services/audit/audit.types";

/** Rendered for any value that wasn't set — e.g. the "before" of a creation. */
const EMPTY_VALUE = "—";

/**
 * Eye-icon button that opens a dialog listing an event's field-level
 * before/after values. Used for every event that recorded changes: edits show
 * both sides, while creations render a hyphen on the "before" side and deletions
 * render one on the "after" side.
 */
export function ChangeDetailsDialog({
  changes,
  entityLabel,
  actor,
  createdAt,
}: {
  changes: AuditFieldChange[];
  entityLabel: string;
  /** Null when the action had no signed-in actor (system/citizen events). */
  actor?: AuditActor | null;
  createdAt?: string;
}) {
  const t = useTranslations("app.settings.audit");

  return (
    <Dialog>
      <DialogTrigger
        aria-label={t("viewChanges")}
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2"
      >
        <Eye className="size-4" />
      </DialogTrigger>
      {/* Wider than the default sm:max-w-sm: three value columns of arbitrary
          strings (emails, ids, long field names) at 384px wrap every cell to
          three lines, which is exactly what makes a before/after pair hard to
          read side by side. */}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("changesTitle")}</DialogTitle>
          <DialogDescription>
            {t("changesDescription", { item: entityLabel })}
          </DialogDescription>
        </DialogHeader>

        {/* Who and when, alongside what changed — an auditor reading a
            before/after pair needs to attribute it without closing the dialog
            and hunting for the row again. */}
        {actor !== undefined || createdAt ? (
          <div className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <User className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-foreground truncate font-medium">
                  {actor?.name ?? t("systemActor")}
                </p>
                {actor?.email ? (
                  <p className="text-muted-foreground truncate">{actor.email}</p>
                ) : null}
              </div>
            </div>
            {createdAt ? (
              <span className="text-muted-foreground shrink-0 tabular-nums">
                <FormattedDate value={createdAt} withTime />
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="border-border overflow-hidden rounded-lg border">
          <div className="text-muted-foreground bg-muted/50 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-xs font-medium">
            <span>{t("fieldColumn")}</span>
            <span>{t("beforeColumn")}</span>
            <span className="w-3.5" aria-hidden />
            <span>{t("afterColumn")}</span>
          </div>
          {/* Events with many changed fields scroll inside the box rather
              than pushing the dialog past the viewport. */}
          <ul className="divide-border max-h-[55vh] divide-y overflow-y-auto">
            {changes.map((change) => (
              <li
                key={change.field}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-sm"
              >
                <span className="text-foreground font-medium break-words">
                  {change.field}
                </span>
                <span className="text-muted-foreground break-words">
                  {change.before ?? EMPTY_VALUE}
                </span>
                <ArrowRight className="text-muted-foreground size-3.5" aria-hidden />
                <span className="text-foreground font-medium break-words">
                  {change.after ?? EMPTY_VALUE}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
