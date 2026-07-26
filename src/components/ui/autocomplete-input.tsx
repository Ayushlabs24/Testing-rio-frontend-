"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

// A plain free-text Input that suggests existing values as the user types
// (e.g. KPI labels already used elsewhere in the Question Bank) without ever
// restricting them to one of those — unlike Combobox (fixed list, must pick
// one) or MultiSelect (fixed list, multi-pick), whatever's actually typed
// here is always the final value; picking a suggestion just fills it in
// faster. Uses PopoverAnchor (not PopoverTrigger) so the suggestion list is
// purely typing/focus-driven — no click-to-toggle trigger behavior to fight
// with normal text input interaction.
export function AutocompleteInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  "aria-invalid": ariaInvalid,
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false);

  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed
    ? options.filter(
        (option) =>
          option.toLowerCase().includes(trimmed) && option.toLowerCase() !== trimmed,
      )
    : options;

  return (
    <Popover open={open && filtered.length > 0}>
      {/* PopoverAnchor's `asChild` clones its immediate child and needs a
          ref-able element — `Input` doesn't forward one, so a plain `div`
          wrapper takes the ref instead. */}
      <PopoverAnchor asChild>
        <div>
          <Input
            id={id}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={ariaInvalid}
            autoComplete="off"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-(--radix-popper-anchor-width) max-w-(--radix-popper-available-width) p-1"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="max-h-56 overflow-y-auto">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              // Fires before the Input's onBlur would close the popover —
              // without this, the click never registers because the option
              // list unmounts (via `open` flipping false) first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-pointer items-center overflow-hidden rounded-md px-2.5 py-1.5 text-left text-sm"
            >
              <span className="truncate">{option}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
