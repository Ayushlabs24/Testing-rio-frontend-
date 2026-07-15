import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't infer it from a stray
  // lockfile in a parent directory (which breaks relative CSS @imports).
  turbopack: { root: __dirname },
};

export default withNextIntl(nextConfig);
