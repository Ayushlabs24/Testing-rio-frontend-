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
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
