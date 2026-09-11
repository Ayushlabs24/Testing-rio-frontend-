"use client";

import { useState } from "react";
import { AlertTriangle, Database, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorTable } from "@/components/features/studies/needs-import-shared";
import { historicalStudiesService } from "@/services/historical-studies/historical-studies.service";
import type { HistoricalStudyImportResult } from "@/services/historical-studies/historical-studies.types";
import { isImportableFileName } from "@/services/historical-studies/historical-studies.types";
import type { ArchiveEntry } from "@/services/archive/archive.types";
import { ApiError } from "@/services/api/types";

/**
 * RIO-DATA-002 / FR-17 — imports an archived pre-platform study
 * (RIO-FR-013) into the unified dashboard.
 *
 * The BRD is explicit that the Center's prior study must not sit behind an
 * external BI link. A downloadable attachment fails the same test, so this
 * turns the needs *inside* the archived file into real Need rows under a
 * Study flagged historical — after which the dashboard, its filters and
 * FR-003 priority scoring apply to them with no special-casing.
 *
 * The dialog stays open on a partial import so the skipped rows remain
 * readable; the caller refreshes the archive list through `onImported`.
 */
export function HistoricalStudyImportDialog({
  entry,
  open,
  onOpenChange,
  onImported,
}: {
  entry: ArchiveEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const t = useTranslations("app.archive");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HistoricalStudyImportResult | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<HistoricalStudyImportResult["errors"]>([]);

  const importable = entry?.fileName ? isImportableFileName(entry.fileName) : false;

  function handleOpenChange(next: boolean) {
    // Never drop a request mid-flight — the server would still create the
    // Study while the UI forgot it asked.
    if (busy) return;
    if (!next) {
      setResult(null);
      setFailureMessage(null);
      setRowErrors([]);
    }
    onOpenChange(next);
  }

  async function runImport() {
    if (!entry) return;
    setBusy(true);
    setFailureMessage(null);
    setRowErrors([]);
    try {
      const outcome = await historicalStudiesService.importToDashboard(entry.id);
      setResult(outcome);
      onImported();
      // A clean run has nothing left to read, so close it out. A partial one
      // keeps the skipped rows on screen.
      if (outcome.failed === 0) onOpenChange(false);
    } catch (err) {
      // NO_ROWS_IMPORTED carries the per-row reasons the file could not be
      // read, which is the only actionable thing in that failure.
      const detail = extractFailure(err);
      setFailureMessage(detail.message ?? t("importFailed"));
      setRowErrors(detail.errors);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("importToDashboard")}</DialogTitle>
          <DialogDescription>
            {entry ? t("importDialogDescription", { title: entry.title }) : ""}
          </DialogDescription>
        </DialogHeader>

        {!importable ? (
          <p className="text-destructive flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{t("importNotSupported")}</span>
          </p>
        ) : null}

        {result ? (
          <div className="space-y-3">
            <p className="text-sm">
              {result.failed === 0
                ? t("importSuccess", {
                    imported: result.imported,
                    total: result.totalRows,
                    study: result.studyTitle,
                  })
                : t("importPartial", {
                    imported: result.imported,
                    total: result.totalRows,
                    study: result.studyTitle,
                    failed: result.failed,
                  })}
            </p>
            {result.errors.length > 0 ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {t("importErrorsTitle")}
                </p>
                <ErrorTable rows={result.errors} destructive={false} />
              </div>
            ) : null}
          </div>
        ) : null}

        {failureMessage ? (
          <div className="space-y-3">
            <p className="text-destructive flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{failureMessage}</span>
            </p>
            {rowErrors.length > 0 ? (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {t("importErrorsTitle")}
                </p>
                <ErrorTable rows={rowErrors} destructive />
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            {t("importDialogClose")}
          </Button>
          {result ? null : (
            <Button onClick={runImport} disabled={busy || !importable}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("importing")}
                </>
              ) : (
                <>
                  <Database className="size-4" />
                  {t("importToDashboard")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Pulls the message and any per-row reasons out of an ApiError.
 *
 *  The client puts the envelope's `error.message` on `.message`, and — since
 *  the backend sends no `error.details` — leaves the whole `{ error: ... }`
 *  body on `.details`. NO_ROWS_IMPORTED carries its per-row reasons there,
 *  which are the only actionable part of that failure. */
function extractFailure(err: unknown): {
  message: string | null;
  errors: HistoricalStudyImportResult["errors"];
} {
  const message = err instanceof ApiError || err instanceof Error ? err.message : null;
  const details = err instanceof ApiError ? err.details : undefined;
  const body = (details as { error?: { errors?: unknown } } | undefined)?.error;
  return {
    message,
    errors: Array.isArray(body?.errors)
      ? (body.errors as HistoricalStudyImportResult["errors"])
      : [],
  };
}
