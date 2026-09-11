"use client";

import * as React from "react";
import { forwardRef, useCallback, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { ChevronDown, CheckIcon, Globe } from "lucide-react";
import { CircleFlag } from "react-circle-flags";

import { countries } from "country-data-list";

// Client decision (2026-09): country *names* in this dropdown stay English
// in every locale, including Arabic — `country-data-list` has no Arabic
// name data, and translating even a curated subset was judged not worth it
// since the flag (visual) and calling code (numeric) already carry the
// meaning a user actually needs. Only this component's own chrome text
// (search placeholder, empty state — see searchPlaceholder/emptyText
// below) is localized.
export interface Country {
  alpha2: string;
  alpha3: string;
  countryCallingCodes: string[];
  currencies: string[];
  emoji?: string;
  ioc: string;
  languages: string[];
  name: string;
  status: string;
}

interface CountryDropdownProps {
  options?: Country[];
  onChange?: (country: Country) => void;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  slim?: boolean;
  "aria-label"?: string;
  /** i18n — this component ships from a third-party source with English
   * strings hardcoded, so callers must pass these rather than relying on a
   * built-in default. */
  searchPlaceholder?: string;
  emptyText?: string;
}

const CountryDropdownComponent = (
  {
    options = countries.all.filter(
      (country: Country) =>
        country.emoji && country.status !== "deleted" && country.ioc !== "PRK",
    ),
    onChange,
    defaultValue,
    disabled = false,
    placeholder = "Select a country",
    slim = false,
    "aria-label": ariaLabel,
    searchPlaceholder = "Search country...",
    emptyText = "No country found.",
    ...props
  }: CountryDropdownProps,
  ref: React.ForwardedRef<HTMLButtonElement>,
) => {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | undefined>(() =>
    defaultValue ? options.find((country) => country.alpha3 === defaultValue) : undefined,
  );
  // Re-derive during render (not in an effect — avoids an extra render pass)
  // whenever the caller passes a different `defaultValue`, e.g. a phone
  // input switching which record it's editing. `useState`'s lazy
  // initializer above only ever runs once, so this is what keeps a changed
  // `defaultValue` in sync after the first mount.
  const [syncedDefaultValue, setSyncedDefaultValue] = useState(defaultValue);
  if (defaultValue !== syncedDefaultValue) {
    setSyncedDefaultValue(defaultValue);
    setSelectedCountry(
      defaultValue
        ? options.find((country) => country.alpha3 === defaultValue)
        : undefined,
    );
  }

  const handleSelect = useCallback(
    (country: Country) => {
      setSelectedCountry(country);
      onChange?.(country);
      setOpen(false);
    },
    [onChange],
  );

  const triggerClasses = cn(
    "border-input flex h-8 w-full items-center justify-between gap-1 rounded-lg border bg-transparent px-2.5 text-sm whitespace-nowrap ring-offset-background placeholder:text-muted-foreground focus:ring-ring focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
    slim === true && "w-[4.25rem] shrink-0",
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        ref={ref}
        className={triggerClasses}
        disabled={disabled}
        aria-label={ariaLabel}
        {...props}
      >
        {selectedCountry ? (
          <div className="flex w-0 flex-grow items-center gap-2 overflow-hidden">
            <div className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <CircleFlag
                countryCode={selectedCountry.alpha2.toLowerCase()}
                height={20}
              />
            </div>
            {slim === false && (
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {selectedCountry.name}
              </span>
            )}
          </div>
        ) : (
          <span>{slim === false ? placeholder : <Globe size={20} />}</span>
        )}
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        collisionPadding={10}
        side="bottom"
        className="min-w-[--radix-popper-anchor-width] p-0"
      >
        <Command className="max-h-[200px] w-full sm:max-h-[270px]">
          <CommandList>
            <div className="bg-popover sticky top-0 z-10">
              <CommandInput placeholder={searchPlaceholder} />
            </div>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options
                .filter((x) => x.name)
                .map((option) => (
                  <CommandItem
                    className="flex w-full items-center gap-2"
                    key={option.alpha3}
                    onSelect={() => handleSelect(option)}
                  >
                    <div className="flex w-0 flex-grow space-x-2 overflow-hidden">
                      <div className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
                        <CircleFlag
                          countryCode={option.alpha2.toLowerCase()}
                          height={20}
                        />
                      </div>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                        {option.name}
                      </span>
                    </div>
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0",
                        option.alpha3 === selectedCountry?.alpha3
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

CountryDropdownComponent.displayName = "CountryDropdownComponent";

export const CountryDropdown = forwardRef(CountryDropdownComponent);
