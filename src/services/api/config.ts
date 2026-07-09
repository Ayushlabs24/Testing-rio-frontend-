import { env } from "@/config/env";

export const apiConfig = {
  baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
  timeoutMs: env.NEXT_PUBLIC_API_TIMEOUT_MS,
} as const;
