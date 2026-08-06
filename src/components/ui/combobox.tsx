"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxItem {
  value: string;
  label: string;
  /** Optional secondary line shown under `label` in the dropdown list only (e.g. an email under a person's name). */
  description?: string;
}

interface ComboboxProps {
  items: ComboboxItem[];
  value: string | null;
  onSelect: (value: string) => void;
  onQueryChange?: (query: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  loading?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

// A minimal searchable single-select — no cmdk dependency, built on the
// same Popover primitive as the rest of the UI kit. `onQueryChange` lets a
// caller do server-side search (e.g. Sharing's org lookup); when omitted,
// filtering happens locally against `items` (e.g. Reports' static type list).
export function Combobox({
  items,
  value,
  onSelect,
  onQueryChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  loading,
  disabled,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = items.find((item) => item.value === value);
  const filtered = onQueryChange
    ? items
    : items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  function handleQueryChange(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) handleQueryChange("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 overflow-hidden rounded-lg border bg-transparent px-2.5 text-sm transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-start">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popper-anchor-width) max-w-(--radix-popper-available-width) p-0"
        align="start"
      >
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto p-1"
          // Radix's Dialog scroll-lock (react-remove-scroll) can swallow
          // wheel events over this list when the Combobox is opened from
          // inside a Dialog, since the popover's content is portaled
          // outside the Dialog's own scroll-allowed region — the list looks
          // scrollable but the mouse wheel does nothing. Scrolling it
          // directly here works regardless of what's intercepting the
          // native wheel-to-scroll behavior.
          onWheel={(event) => {
            if (listRef.current) listRef.current.scrollTop += event.deltaY;
          }}
        >
          {loading ? (
            <p className="text-muted-foreground px-2.5 py-4 text-center text-sm">
              {searchPlaceholder}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-4 text-center text-sm">
              {emptyText}
            </p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onSelect(item.value);
                  setOpen(false);
                }}
                className="hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-md px-2.5 py-1.5 text-start text-sm"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.description ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                {item.value === value ? <Check className="size-4 shrink-0" /> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
