"use client";

import { ChevronsUpDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional group heading (e.g. a parent Domain for a Sub-domain option)
   * — options sharing a `group` are clustered together under one label,
   * with a separator between groups. Ungrouped options (no `group` on any
   * option) render as a single flat list, unchanged from before. */
  group?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  removeAriaLabel: (label: string) => string;
  disabled?: boolean;
  /** Selected-items label, e.g. "{count} more" — shown as a collapse chip
   * once more than `maxVisibleChips` are selected. */
  moreLabel?: (count: number) => string;
  /** Chips shown before collapsing the rest into a "+N more" chip. Default 4. */
  maxVisibleChips?: number;
  /** Label for the popover's explicit close action. Defaults to "Done". */
  doneLabel?: string;
  /** Fires whenever the popover opens/closes (Done, outside click, or Esc)
   * — for a caller that needs to react to "the picker is closed now" rather
   * than every individual toggle inside `onChange` (e.g. running an
   * expensive query only once selection is finished, not per checkbox). */
  onOpenChange?: (open: boolean) => void;
  /** Pins the trigger to a single fixed-height row instead of letting
   * selected chips wrap onto additional lines as more are picked — for a
   * caller placed in a row alongside other fixed-height fields (e.g. a
   * Region Select) where a growing height would break the row's alignment.
   * Overflow beyond `maxVisibleChips` is simply clipped rather than
   * expandable in place; the full selection is always still visible/
   * editable in the popover itself. */
  singleLine?: boolean;
}

const DEFAULT_MAX_VISIBLE_CHIPS = 4;

// A searchable multi-select over a fixed option list (no free-text add) —
// selected items render as removable Badges *inside* the trigger field
// itself (not as a separate row above it), options are toggled via
// checkbox in a Popover list. Used wherever a caller must pick from a known
// reference set (e.g. Regions/Governorates), unlike GovernoratePicker
// (which also allows adding free-text values not on its list).
//
// The trigger is a div (not a button) specifically so each chip's own
// remove "x" can be a real interactive element without nesting a <button>
// inside a <button> (invalid HTML) — clicking a chip's "x" stops
// propagation so it removes that value instead of opening the popover.
export function MultiSelect({
  options,
  values,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  removeAriaLabel,
  disabled,
  moreLabel,
  maxVisibleChips = DEFAULT_MAX_VISIBLE_CHIPS,
  doneLabel,
  onOpenChange,
  singleLine = false,
}: MultiSelectProps) {
  const tCommon = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [chipsExpanded, setChipsExpanded] = React.useState(false);
  const listboxId = React.useId();

  const byValue = new Map(options.map((o) => [o.value, o.label]));
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function toggle(value: string) {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  // Cluster options by `group`, preserving first-appearance order — options
  // with no `group` at all (the common case) fall through to a flat list,
  // unchanged from before this was added.
  const groupOrder: string[] = [];
  const groupedOptions = new Map<string, MultiSelectOption[]>();
  const ungroupedOptions: MultiSelectOption[] = [];
  for (const option of filtered) {
    if (option.group === undefined) {
      ungroupedOptions.push(option);
      continue;
    }
    if (!groupedOptions.has(option.group)) {
      groupedOptions.set(option.group, []);
      groupOrder.push(option.group);
    }
    groupedOptions.get(option.group)!.push(option);
  }

  function renderOption(option: MultiSelectOption) {
    return (
      <label
        key={option.value}
        className="hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2.5 py-1.5 text-left text-sm"
      >
        <Checkbox
          checked={values.includes(option.value)}
          onCheckedChange={() => toggle(option.value)}
        />
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </label>
    );
  }

  // Past a handful of selections, showing every chip clutters the field —
  // collapse the rest into a "+N more" chip instead (click to expand in
  // place; the dropdown itself always shows every selection checked
  // regardless of this collapsed state).
  const visibleValues =
    (chipsExpanded && !singleLine) || values.length <= maxVisibleChips
      ? values
      : values.slice(0, maxVisibleChips);
  const hiddenCount = values.length - visibleValues.length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
        onOpenChange?.(next);
      }}
    >
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 text-muted-foreground flex w-full items-center gap-1.5 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none select-none focus-visible:ring-3",
            singleLine ? "h-8 flex-nowrap overflow-hidden" : "min-h-8 flex-wrap",
            disabled
              ? "pointer-events-none cursor-not-allowed opacity-50"
              : "cursor-pointer",
          )}
        >
          {values.length === 0 ? (
            <>
              <Search className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{placeholder}</span>
            </>
          ) : (
            <>
              {visibleValues.map((value) => (
                // `Badge`'s base variant is `shrink-0 whitespace-nowrap` with
                // no max-width, so a long label (e.g. a full study title)
                // just grows past the trigger's right edge instead of
                // wrapping to a new line — `max-w-full` bounds it to the
                // container's own width so flex-wrap always has a fitting
                // size to wrap on, and the inner `truncate` span ellipsizes
                // the label itself rather than the whole chip (keeping the
                // remove "x" visible).
                <Badge
                  key={value}
                  variant="secondary"
                  className={cn("max-w-full min-w-0 gap-1", singleLine && "shrink")}
                >
                  <span className="min-w-0 truncate">{byValue.get(value) ?? value}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(values.filter((v) => v !== value));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                        event.preventDefault();
                        onChange(values.filter((v) => v !== value));
                      }
                    }}
                    aria-label={removeAriaLabel(byValue.get(value) ?? value)}
                    className="shrink-0"
                  >
                    <X className="size-3" />
                  </span>
                </Badge>
              ))}
              {hiddenCount > 0 ? (
                <Badge
                  variant="outline"
                  className={singleLine ? undefined : "hover:bg-accent cursor-pointer"}
                  onClick={
                    singleLine
                      ? undefined
                      : (event) => {
                          event.stopPropagation();
                          setChipsExpanded(true);
                        }
                  }
                >
                  {moreLabel ? moreLabel(hiddenCount) : `+${hiddenCount} more`}
                </Badge>
              ) : null}
              {!singleLine && chipsExpanded && values.length > maxVisibleChips ? (
                <Badge
                  variant="outline"
                  className="hover:bg-accent cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setChipsExpanded(false);
                  }}
                >
                  &minus;
                </Badge>
              ) : null}
            </>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0" />
        </div>
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div
          id={listboxId}
          role="listbox"
          className="max-h-64 overflow-y-auto p-1"
          // Dialog's scroll lock treats this body-portaled Popover as outside
          // the modal and cancels wheel events when they reach `document`.
          // Keep the wheel event inside the actual scroll container so its
          // native overflow scrolling is allowed to run.
          onWheel={(event) => event.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2.5 py-4 text-center text-sm">
              {emptyText}
            </p>
          ) : groupOrder.length === 0 ? (
            filtered.map((option) => renderOption(option))
          ) : (
            <>
              {ungroupedOptions.map((option) => renderOption(option))}
              {groupOrder.map((group, index) => (
                <div key={group}>
                  {index > 0 || ungroupedOptions.length > 0 ? (
                    <Separator className="my-1" />
                  ) : null}
                  <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-medium">
                    {group}
                  </p>
                  {(groupedOptions.get(group) ?? []).map((option) =>
                    renderOption(option),
                  )}
                </div>
              ))}
            </>
          )}
        </div>
        {/* Staying open after each pick is deliberate (so several options
            can be checked in a row), but with no other visible way to
            dismiss it, that read as broken/stuck — an explicit close action
            makes "you're done, click here" obvious rather than relying on
            an outside click a user might not think to try. */}
        <div className="border-border border-t p-1.5">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenChange?.(false);
            }}
            className="hover:bg-accent hover:text-accent-foreground w-full cursor-pointer rounded-md px-2.5 py-1.5 text-center text-sm font-medium"
          >
            {doneLabel ?? tCommon("done")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
