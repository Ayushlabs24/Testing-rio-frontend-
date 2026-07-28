"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// A Need can span multiple Domains/Sub-domains (see Need.needDomains) — show
// the first two as individual badges and collapse the rest into a "+N more"
// badge rather than letting the list grow unbounded. Shared by every page
// that displays a Need's classification: the AI Review panel, the Survey
// Builder list/review pages, and anywhere else a Need's domain(s) render.
const MAX_VISIBLE_CHIPS = 2;

export function DomainChips({
  items,
  variant,
  border = false,
  expandDialogTitle,
  expandDialogContent,
}: {
  items: string[];
  variant: "primary" | "secondary";
  border?: boolean;
  /** When provided, the "+N more" pill becomes clickable and opens a small
   *  dialog listing every item — useful for long working domain lists. */
  expandDialogTitle?: string;
  /** Custom content for the expand dialog. Defaults to a badge list of all
   *  items. */
  expandDialogContent?: React.ReactNode;
}) {
  const t = useTranslations("app.common");
  const [open, setOpen] = useState(false);
  const visible = items.slice(0, MAX_VISIBLE_CHIPS);
  const remaining = items.length - visible.length;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => (
          <Badge
            key={item}
            className={cn(
              border &&
                `border border-${variant === "primary" ? "primary" : "secondary"}`,
              variant === "primary"
                ? "bg-badge-primary text-badge-primary-foreground"
                : "bg-badge-secondary text-badge-secondary-foreground",
            )}
          >
            {item}
          </Badge>
        ))}
        {remaining > 0 ? (
          expandDialogTitle ? (
            <Badge
              asChild
              className={cn(
                border && "border-muted-foreground/30 border",
                "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              <button type="button" onClick={() => setOpen(true)}>
                {t("moreCount", { count: remaining })}
              </button>
            </Badge>
          ) : (
            <Badge
              className={cn(
                border && "border-muted-foreground/30 border",
                "bg-muted text-muted-foreground",
              )}
            >
              {t("moreCount", { count: remaining })}
            </Badge>
          )
        ) : null}
      </div>
      {expandDialogTitle ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{expandDialogTitle}</DialogTitle>
            </DialogHeader>
            {expandDialogContent ?? (
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <Badge
                    key={item}
                    className={cn(
                      border &&
                        `border border-${variant === "primary" ? "primary" : "secondary"}`,
                      variant === "primary"
                        ? "bg-badge-primary text-badge-primary-foreground"
                        : "bg-badge-secondary text-badge-secondary-foreground",
                    )}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
