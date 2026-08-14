// Mirrors the backend's src/modules/nic-registry/nic-number.util.ts. The
// server is the gate — it normalizes and re-checks every submission against
// the NIC entity registry — but the same fold has to exist here so the form
// can tell a registrant their number is the wrong shape before a round trip,
// and so a number typed with dashes or on an Arabic keyboard isn't flagged
// client-side as invalid when the server would accept it.
//
// Keep the two in step: a client fold that is stricter than the server's
// blocks valid registrants outright.

// Arabic-Indic (U+0660-U+0669) and Extended Arabic-Indic (U+06F0-U+06F9)
// digits; both blocks run 0-9 in order.
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

// Whitespace, NBSP, dashes, slashes, dots, underscores, bidi marks. An
// explicit list, not "every non-digit" — the latter would quietly rescue
// genuinely malformed input.
const SEPARATORS = /[\s ‎‏؜ـ‐-―\-_/.]/g;

/** A registration number as the backend stores it: exactly 10 ASCII digits. */
export const REGISTRATION_NUMBER_PATTERN = /^\d{10}$/;

export function normalizeRegistrationNumber(raw: string): string {
  return raw
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) & 0x0f))
    .replace(SEPARATORS, "");
}

export function isValidRegistrationNumberShape(raw: string): boolean {
  return REGISTRATION_NUMBER_PATTERN.test(normalizeRegistrationNumber(raw));
}
