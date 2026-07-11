"use client";

import { ArrowRight, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AuditFieldChange } from "@/services/audit/audit.types";

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
}: {
  changes: AuditFieldChange[];
  entityLabel: string;
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changesTitle")}</DialogTitle>
          <DialogDescription>
            {t("changesDescription", { item: entityLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="border-border overflow-hidden rounded-lg border">
          <div className="text-muted-foreground bg-muted/50 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-xs font-medium">
            <span>{t("fieldColumn")}</span>
            <span>{t("beforeColumn")}</span>
            <span className="w-3.5" aria-hidden />
            <span>{t("afterColumn")}</span>
          </div>
          <ul className="divide-border divide-y">
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
