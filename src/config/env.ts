import { z } from "zod";

/**
 * Centralized, validated access to environment variables.
 * Add new variables here — never read `process.env` directly elsewhere.
 */
const envSchema = z.object({
  // Backend keeps its own default port (3000); the frontend dev server runs
  // on 3001 instead of contesting it.
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3001"),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:3000/api"),
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce.number().positive().default(15000),
  // Gates the mock staff-OTP sign-in flow (src/services/auth/otp.mock.ts) —
  // the real backend has no OTP-sign-in endpoint yet, so this must stay
  // "false" (the default) in every real deployment. Only ever set "true"
  // for local development or a dedicated test build that needs to exercise
  // that UI flow without a backend. Documented here for validation; the
  // actual gate in auth.service.ts reads `process.env` directly (not this
  // parsed object) so bundlers can eliminate the mock module entirely when
  // it's unset — see that file's comment.
  NEXT_PUBLIC_ENABLE_MOCK_AUTH: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

/**
 * A variable declared in a hosting dashboard but left blank arrives as `""`,
 * not as `undefined` — so Zod's `.default()` never applies and `.url()` fails
 * on the empty string. Treat blank (and whitespace-only) as "not set" so the
 * defaults above do their job, which is what someone who cleared the field
 * meant. A value that is present but genuinely wrong still fails, loudly.
 */
const orUndefined = (v: string | undefined) =>
  v === undefined || v.trim() === "" ? undefined : v.trim();

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_APP_URL: orUndefined(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_API_BASE_URL: orUndefined(process.env.NEXT_PUBLIC_API_BASE_URL),
  NEXT_PUBLIC_API_TIMEOUT_MS: orUndefined(process.env.NEXT_PUBLIC_API_TIMEOUT_MS),
  NEXT_PUBLIC_ENABLE_MOCK_AUTH: orUndefined(process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH),
});

if (!parsed.success) {
  // This module is imported during `next build`'s page-data collection, where
  // a raw throw surfaces only as "Failed to collect page data for <route>" and
  // names neither the variable nor the reason. Name both, so a bad deploy
  // setting is a one-line fix instead of a bisect through the route list.
  const details = parsed.error.issues
    .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${details}\n` +
      `Each NEXT_PUBLIC_* URL must be absolute and include the scheme, ` +
      `e.g. https://api.example.com/api`,
  );
}

export const env = parsed.data;
