import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Native replacement for the vite-tsconfig-paths plugin (Vite has
    // supported this directly since 6.5) — resolves the same `@/*` mapping
    // from tsconfig.json without the extra dependency or its deprecation
    // warning.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    exclude: ["node_modules", ".next", "e2e", "playwright-report", "test-results"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "e2e/", ".next/", "**/*.config.*", "**/ui/**"],
    },
  },
});
