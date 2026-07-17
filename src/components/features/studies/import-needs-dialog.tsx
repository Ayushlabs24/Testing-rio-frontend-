"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import type { ImportNeedsResult } from "@/services/needs/needs.types";

const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

/**
 * Bulk-create Needs from a CSV/XLSX file — one Need per row (see the
 * backend's NeedsImportService). PDF isn't supported here — no AI
 * extraction yet; attach a PDF as Evidence on a manually created Need
 * instead.
 */
export function ImportNeedsDialog({
  studyId,
  open,
  onOpenChange,
  onImported,
}: {
  studyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const t = useTranslations("app.studies.import");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A ref, not just the `importing` state — a state update only takes
  // effect on the next render, so a second click landing before that render
  // commits (a fast double-click, or a stuck focus event re-firing) could
  // otherwise slip past the `disabled` check and fire the import twice. The
  // ref is set synchronously, so it can't race.
  const importInFlightRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportNeedsResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setFileError(null);
    setResult(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function selectFile(selected: File) {
    setFileError(null);
    setResult(null);
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(selected.name))) {
      setFileError(t("invalidType"));
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function handleImport() {
    if (!file || importInFlightRef.current) return;
    importInFlightRef.current = true;
    setImporting(true);
    setSubmitError(null);
    try {
      const outcome = await needsService.importFromFile(studyId, file);
      setResult(outcome);
      if (outcome.imported > 0) onImported();
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : t("genericError"));
    } finally {
      importInFlightRef.current = false;
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col sm:max-w-xl"
        showCloseButton={!importing}
        // While a request is in flight, closing (Escape, clicking the
        // backdrop, or the X button) is blocked — see showCloseButton above
        // for the X button; these two cover the other two ways Radix can
        // close a Dialog. Reopening mid-request with stale local state was
        // the likely source of the "tries again" symptom reported here.
        onEscapeKeyDown={(event) => {
          if (importing) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (importing) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {/* The header and footer (Close/Import) stay pinned — only this
         * middle section scrolls, so the results table appearing after
         * import can never push the Close button out of view. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border-input hover:bg-muted/30 flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors"
          >
            <FileSpreadsheet className="text-muted-foreground size-7" />
            <span className="text-foreground text-sm font-medium">
              {file ? file.name : t("chooseFile")}
            </span>
            <span className="text-muted-foreground text-xs">{t("allowedTypesHint")}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) selectFile(selected);
              event.target.value = "";
            }}
          />
          {fileError ? <p className="text-destructive text-sm">{fileError}</p> : null}
          {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}

          {result ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border-border rounded-md border p-3">
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {result.totalRows}
                  </p>
                  <p className="text-muted-foreground text-xs">{t("totalRows")}</p>
                </div>
                <div className="border-border rounded-md border p-3">
                  <p className="text-success text-lg font-semibold tabular-nums">
                    {result.imported}
                  </p>
                  <p className="text-muted-foreground text-xs">{t("imported")}</p>
                </div>
                <div className="border-border rounded-md border p-3">
                  <p className="text-destructive text-lg font-semibold tabular-nums">
                    {result.failed}
                  </p>
                  <p className="text-muted-foreground text-xs">{t("failed")}</p>
                </div>
              </div>

              {result.errors.length > 0 ? (
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">{t("rowColumn")}</TableHead>
                        <TableHead>{t("errorColumn")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err) => (
                        <TableRow key={err.row}>
                          <TableCell>
                            <Badge variant="outline">{err.row}</Badge>
                          </TableCell>
                          <TableCell className="text-destructive text-sm">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            {result ? t("close") : t("cancel")}
          </Button>
          {!result ? (
            <Button
              type="button"
              onClick={handleImport}
              disabled={!file || importing}
              className="gap-1.5"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {importing ? t("importing") : t("import")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
