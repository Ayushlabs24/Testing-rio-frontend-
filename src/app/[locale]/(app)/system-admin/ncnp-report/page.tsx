"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

// The NCNP Compiled Report merged into the unified /reports page (Category
// filter distinguishes NGO vs Consolidated) — kept as a redirect so any
// existing bookmarks/links still land somewhere useful instead of 404ing.
// A client-side redirect rather than a Server Component `redirect()` call —
// the latter was observed to get statically cached and serve a stale 200
// instead of actually redirecting.
export default function NcnpReportRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reports");
  }, [router]);

  return null;
}
