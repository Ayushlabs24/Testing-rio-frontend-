import { z } from "zod";

/**
 * Complexity rules for any password the user *sets* (first-login change,
 * reset-by-token). Deliberately not applied when merely *entering* an
 * existing password (login, the "current password" field) — those must
 * accept whatever was issued, including server-generated temporary
 * passwords that predate this policy.
 */
export const PASSWORD_MIN_LENGTH = 8;

// Anything that isn't a letter, a digit, or whitespace counts as special.
const HAS_SPECIAL = /[^A-Za-z0-9\s]/;

/**
 * The rules, in the order they're shown to the user. `newPasswordSchema`
 * and the `PasswordRequirements` checklist are both built from this list,
 * so what's displayed can never drift from what's enforced.
 */
export const PASSWORD_RULES = [
  {
    key: "min",
    messageKey: "passwordMin",
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    key: "uppercase",
    messageKey: "passwordUppercase",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "number",
    messageKey: "passwordNumber",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    key: "special",
    messageKey: "passwordSpecial",
    test: (value: string) => HAS_SPECIAL.test(value),
  },
] as const;

type Translate = (key: string) => string;

/**
 * Builds the new-password field schema. Takes the `auth.validation`
 * translator so messages stay localized at the call site (schemas are
 * built inside components, per-render, for exactly this reason).
 */
export function newPasswordSchema(tValidation: Translate) {
  // Written out rather than folded over PASSWORD_RULES: `.reduce()` widens
  // the schema's inferred input to `unknown`, which breaks the resolver
  // typing at every call site. The predicates still come from PASSWORD_RULES,
  // so display and enforcement stay in lockstep.
  return z
    .string()
    .refine(PASSWORD_RULES[0].test, { message: tValidation("passwordMin") })
    .refine(PASSWORD_RULES[1].test, { message: tValidation("passwordUppercase") })
    .refine(PASSWORD_RULES[2].test, { message: tValidation("passwordNumber") })
    .refine(PASSWORD_RULES[3].test, { message: tValidation("passwordSpecial") });
}
