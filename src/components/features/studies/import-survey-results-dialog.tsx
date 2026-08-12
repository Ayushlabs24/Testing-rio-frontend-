"use client";

import { FileCheck, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extensionOf } from "@/lib/file-utils";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import type {
  ImportNeedsResult,
  ParsedPdfNeedItem,
} from "@/services/needs/needs.types";
import { EditableNeedsPreviewTable, ErrorTable } from "./needs-import-shared";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt"];

export function ImportSurveyResultsDialog({
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
  const t = useTranslations("app.studies.importSurveyResults");
  const tCommon = useTranslations("app.studies.import");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // A ref, not just the `importing` state — a state update only takes
  // effect on the next render, so a second click landing before that render
  // commits (a fast double-click, or a stuck focus event re-firing) could
  // otherwise slip past the `disabled` check and fire the import twice. The
  // ref is set synchronously, so it can't race.
  const importInFlightRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [extractedNeeds, setExtractedNeeds] = useState<ParsedPdfNeedItem[] | null>(null);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportNeedsResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setFileError(null);
    setParsing(false);
    setExtractedNeeds(null);
    setResult(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function selectFile(selected: File) {
    setFileError(null);
    setResult(null);
    setExtractedNeeds(null);
    const ext = extensionOf(selected.name);

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(t("invalidType"));
      setFile(null);
      return;
    }

    setFile(selected);
    setParsing(true);
    setSubmitError(null);

    try {
      const preview = await needsService.previewSurveyResultsFromFile(studyId, selected);
      setExtractedNeeds(preview.needs);
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : tCommon("genericError"));
      setExtractedNeeds(null);
    } finally {
      setParsing(false);
    }
  }

  function updateNeedField(id: string, field: keyof ParsedPdfNeedItem, value: string) {
    setExtractedNeeds((prev) =>
      prev
        ? prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        : null,
    );
  }

  function removeNeed(id: string) {
    setExtractedNeeds((prev) => (prev ? prev.filter((item) => item.id !== id) : null));
  }

  async function handleImport() {
    if (!extractedNeeds || extractedNeeds.length === 0 || importInFlightRef.current)
      return;
    importInFlightRef.current = true;
    setImporting(true);
    setSubmitError(null);

    try {
      // ParsedPdfNeedItem is structurally compatible with BulkImportNeedItem
      // (extra `id` field is ignored by the backend) — no mapping needed.
      const outcome = await needsService.importBulkNeeds(studyId, extractedNeeds);

      setResult(outcome);
      if (outcome.imported > 0) onImported();
      // Fully successful (nothing to review) — close on its own after a
      // moment instead of leaving the user to find and click Close. Any
      // failed row (duplicate or otherwise) keeps the dialog open so the
      // results stay visible.
      if (outcome.failed === 0 && outcome.imported > 0) {
        setTimeout(() => handleOpenChange(false), 1200);
      }
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : tCommon("genericError"));
    } finally {
      importInFlightRef.current = false;
      setImporting(false);
    }
  }

  const duplicateErrors = result?.errors.filter((e) => e.type === "duplicate") ?? [];
  const otherErrors = result?.errors.filter((e) => e.type !== "duplicate") ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`flex max-h-[85vh] flex-col ${
          extractedNeeds ? "sm:max-w-3xl" : "sm:max-w-xl"
        }`}
        showCloseButton={!importing && !parsing}
        // While a request is in flight, closing (Escape, clicking the
        // backdrop, or the X button) is blocked — see showCloseButton above
        // for the X button; these two cover the other two ways Radix can
        // close a Dialog. Reopening mid-request with stale local state was
        // the likely source of the "tries again" symptom reported here.
        onEscapeKeyDown={(event) => {
          if (importing || parsing) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (importing || parsing) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{extractedNeeds ? t("previewTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {extractedNeeds ? t("previewDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        {/* The header and footer (Close/Import) stay pinned — only this
         * middle section scrolls, so the results table appearing after
         * import can never push the Close button out of view. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {!extractedNeeds && !result ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-input hover:bg-muted/30 flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors"
            >
              <FileCheck className="text-muted-foreground size-7" />
              <span className="text-foreground text-sm font-medium">
                {file ? file.name : t("chooseFile")}
              </span>
              <span className="text-muted-foreground text-xs">{t("allowedTypesHint")}</span>
            </button>
          ) : null}

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

          {parsing ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Loader2 className="text-primary size-8 animate-spin" />
              <p className="text-foreground mt-3 text-sm font-medium">
                {t("parsingDocument")}
              </p>
            </div>
          ) : null}

          {fileError ? <p className="text-destructive text-sm">{fileError}</p> : null}
          {submitError ? <p className="text-destructive text-sm">{submitError}</p> : null}

          {extractedNeeds && !result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">
                  {t("previewCount", { count: extractedNeeds.length })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => reset()}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  {tCommon("backToSelect")}
                </Button>
              </div>

              <EditableNeedsPreviewTable
                needs={extractedNeeds}
                emptyMessage={t("noNeedsFound")}
                onUpdateField={updateNeedField}
                onRemove={removeNeed}
              />
            </div>
          ) : null}

          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="border-border rounded-md border p-3">
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {result.totalRows}
                  </p>
                  <p className="text-muted-foreground text-xs">{tCommon("totalRows")}</p>
                </div>
                <div className="border-border rounded-md border p-3">
                  <p className="text-success text-lg font-semibold tabular-nums">
                    {result.imported}
                  </p>
                  <p className="text-muted-foreground text-xs">{tCommon("imported")}</p>
                </div>
                <div className="border-border rounded-md border p-3">
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {duplicateErrors.length}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {tCommon("duplicatesSkipped")}
                  </p>
                </div>
                <div className="border-border rounded-md border p-3">
                  <p className="text-destructive text-lg font-semibold tabular-nums">
                    {otherErrors.length}
                  </p>
                  <p className="text-muted-foreground text-xs">{tCommon("otherFailures")}</p>
                </div>
              </div>

              {duplicateErrors.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-foreground text-sm font-medium">
                    {tCommon("duplicatesSkipped")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {tCommon("duplicatesSkippedNote")}
                  </p>
                  <ErrorTable rows={duplicateErrors} destructive={false} />
                </div>
              ) : null}

              {otherErrors.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-foreground text-sm font-medium">
                    {tCommon("otherFailures")}
                  </p>
                  <ErrorTable rows={otherErrors} destructive />
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
            disabled={importing || parsing}
          >
            {result ? tCommon("close") : tCommon("cancel")}
          </Button>

          {!result ? (
            <Button
              type="button"
              onClick={handleImport}
              disabled={
                !file ||
                importing ||
                parsing ||
                !extractedNeeds ||
                extractedNeeds.length === 0
              }
              className="gap-1.5"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {importing
                ? tCommon("importing")
                : extractedNeeds
                  ? tCommon("confirmImport", { count: extractedNeeds.length })
                  : tCommon("import")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
