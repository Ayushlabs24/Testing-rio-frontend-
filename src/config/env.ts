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

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
  NEXT_PUBLIC_ENABLE_MOCK_AUTH: process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH,
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
