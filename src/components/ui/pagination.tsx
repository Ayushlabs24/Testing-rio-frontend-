"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  pageLabel: (page: number, pageCount: number) => string;
  className?: string;
}

/**
 * Minimal prev/next + page-indicator pagination — deliberately not a full
 * page-number strip, since nothing in this app has a data set large enough
 * to need one yet. All labels are passed in from i18n, not hard-coded.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  previousLabel,
  nextLabel,
  pageLabel,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={pageLabel(page, pageCount)}
      className={cn("flex items-center justify-between gap-3", className)}
    >
      <span className="text-muted-foreground text-xs">{pageLabel(page, pageCount)}</span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {nextLabel}
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}
