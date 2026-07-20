"use client";

import { Check, MapPin, Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseVillageInput } from "@/lib/villages";

interface GovernoratePickerProps {
  values: string[];
  onChange: (values: string[]) => void;
  /** The org's own configured governorates (Settings > Organization) —
   * offered as a pick-from-list dropdown; typing anything not on that list
   * offers adding it as free text, in the same input. */
  options: string[];
}

/** Governorate/village entry for Study and Need forms — one search box that
 * doubles as a dropdown over the org's configured list and a free-text
 * adder for anything not on it. Shared so the two forms never drift. */
export function GovernoratePicker({ values, onChange, options }: GovernoratePickerProps) {
  const t = useTranslations("app.studies.need");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function addValues(additions: string[]) {
    const unique = additions.filter((v) => !values.includes(v));
    if (unique.length > 0) onChange([...values, ...unique]);
  }

  function commitQuery() {
    addValues(parseVillageInput(query));
    setQuery("");
  }

  const availableOptions = options.filter((option) => !values.includes(option));
  const filtered = query
    ? availableOptions.filter((option) =>
        option.toLowerCase().includes(query.toLowerCase()),
      )
    : availableOptions;
  const trimmedQuery = query.trim();
  const exactMatch = filtered.some(
    (option) => option.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canAddQuery = trimmedQuery.length > 0 && !exactMatch;

  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((village) => (
            <Badge key={village} variant="secondary" className="gap-1">
              <MapPin className="size-3" />
              {village}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== village))}
                aria-label={t("removeVillage", { village })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && query) commitQuery();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 text-muted-foreground flex h-8 w-full cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg border bg-transparent px-2.5 text-left text-sm transition-colors outline-none select-none focus-visible:ring-3"
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {t("villageSearchPlaceholder")}
            </span>
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
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (filtered.length > 0 && !canAddQuery) {
                    addValues([filtered[0]]);
                    setQuery("");
                  } else if (canAddQuery) {
                    commitQuery();
                  }
                }
              }}
              placeholder={t("villageSearchPlaceholder")}
              className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  addValues([option]);
                  setQuery("");
                }}
                className="hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-md px-2.5 py-1.5 text-left text-sm"
              >
                <span className="truncate">{option}</span>
                <Check className="size-4 shrink-0 opacity-0" />
              </button>
            ))}
            {canAddQuery ? (
              <button
                type="button"
                onClick={commitQuery}
                className="hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2.5 py-1.5 text-left text-sm"
              >
                <Plus className="size-4 shrink-0" />
                <span className="truncate">
                  {t("addNewVillage", { village: trimmedQuery })}
                </span>
              </button>
            ) : null}
            {filtered.length === 0 && !canAddQuery ? (
              <p className="text-muted-foreground px-2.5 py-4 text-center text-sm">
                {t("noMoreGovernorates")}
              </p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-muted-foreground text-xs">{t("villageFreeTextHint")}</p>
    </div>
  );
}
