"use client";

import { useMemo, useState } from "react";
import { countries } from "country-data-list";
import { CountryDropdown, type Country } from "@/components/ui/country-dropdown";
import { Input } from "@/components/ui/input";

const ALL_COUNTRIES: Country[] = countries.all.filter(
  (c: Country) =>
    c.emoji &&
    c.status !== "deleted" &&
    c.ioc !== "PRK" &&
    c.countryCallingCodes.length > 0,
);

const DEFAULT_COUNTRY = "SAU"; // Saudi Arabia (alpha-3), per client request

/** Longest-matching known calling code first (e.g. "+971" before a bare "+9"). */
const BY_CALLING_CODE = [...ALL_COUNTRIES].sort(
  (a, b) => b.countryCallingCodes[0].length - a.countryCallingCodes[0].length,
);

function countryForValue(value: string): Country | undefined {
  const trimmed = value.trim();
  if (!trimmed) return ALL_COUNTRIES.find((c) => c.alpha3 === DEFAULT_COUNTRY);
  return BY_CALLING_CODE.find((c) => trimmed.startsWith(c.countryCallingCodes[0]));
}

function localPartOf(value: string, country: Country | undefined): string {
  if (!country) return value.replace(/^\+/, "");
  return value.slice(country.countryCallingCodes[0].length);
}

export interface PhoneNumberInputProps {
  id?: string;
  /** Full value, e.g. "+9715XXXXXXXX". Empty string = unset. */
  value: string;
  onChange: (value: string) => void;
  countryLabel?: string;
  /** i18n for the country picker's own search box / empty state — see
   * CountryDropdown, which ships with English-only defaults. */
  countrySearchPlaceholder?: string;
  countryEmptyText?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}

/**
 * RIO MFA — a compact (flag-only) country picker + local-number input that
 * together produce a single "+<calling code><digits>" string for
 * `mobileNumber`. The picker is shadcn's own Command/Popover primitives
 * (matching the rest of the app's design system) rather than a third-party
 * input's own styling — see country-dropdown.tsx.
 */
export function PhoneNumberInput({
  id,
  value,
  onChange,
  countryLabel,
  countrySearchPlaceholder,
  countryEmptyText,
  disabled,
  "aria-invalid": ariaInvalid,
}: PhoneNumberInputProps) {
  const initialCountry = useMemo(() => countryForValue(value), [value]);
  const [country, setCountry] = useState<Country | undefined>(initialCountry);
  const [local, setLocal] = useState(() => localPartOf(value, initialCountry));

  const emit = (nextCountry: Country | undefined, nextLocal: string) => {
    const digits = nextLocal.replace(/\D/g, "");
    onChange(
      digits && nextCountry ? `${nextCountry.countryCallingCodes[0]}${digits}` : "",
    );
  };

  return (
    <div className="flex gap-2">
      <CountryDropdown
        slim
        disabled={disabled}
        defaultValue={country?.alpha3 ?? DEFAULT_COUNTRY}
        aria-label={countryLabel}
        searchPlaceholder={countrySearchPlaceholder}
        emptyText={countryEmptyText}
        onChange={(next) => {
          setCountry(next);
          emit(next, local);
        }}
      />
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        className="min-w-0 flex-1"
        placeholder={country ? `${country.countryCallingCodes[0]} 5XXXXXXXX` : undefined}
        value={local}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        onChange={(e) => {
          const next = e.target.value;
          setLocal(next);
          emit(country ?? ALL_COUNTRIES.find((c) => c.alpha3 === DEFAULT_COUNTRY), next);
        }}
      />
    </div>
  );
}
