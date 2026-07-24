"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Scoped error boundary for everything under the authenticated app shell —
 * the sidebar/topbar (see layout.tsx) stay mounted, only the page content
 * area falls back to this. Nothing rendered this before; an unhandled
 * render error anywhere in `(app)` used to hit Next's raw dev overlay (or a
 * blank page in production) instead of a recoverable in-app state.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
            <AlertTriangle className="text-destructive size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-foreground text-lg font-semibold">{t("title")}</h2>
            <p className="text-muted-foreground max-w-sm text-sm">{t("description")}</p>
          </div>
          <Button onClick={reset}>{t("retry")}</Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
