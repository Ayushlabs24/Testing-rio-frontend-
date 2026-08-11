"use client";

import { FileCheck, Loader2, Trash2, Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type {
  ImportNeedRowError,
  ImportNeedsResult,
  ParsedPdfNeedItem,
} from "@/services/needs/needs.types";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt"];

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

function ErrorTable({
  rows,
  destructive,
}: {
  rows: ImportNeedRowError[];
  destructive: boolean;
}) {
  const t = useTranslations("app.studies.import");
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">{t("rowColumn")}</TableHead>
            <TableHead>{t("errorColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((err) => (
            <TableRow key={err.row}>
              <TableCell>
                <Badge variant="outline">{err.row}</Badge>
              </TableCell>
              <TableCell className={destructive ? "text-destructive text-sm" : "text-sm"}>
                {err.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
      const items = extractedNeeds.map((n) => ({
        title: n.title,
        statement: n.statement,
        village: n.village,
        referenceId: n.referenceId,
      }));
      const outcome = await needsService.importBulkNeeds(studyId, items);

      setResult(outcome);
      if (outcome.imported > 0) onImported();

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
              <span className="text-muted-foreground text-xs">
                {t("allowedTypesHint")}
              </span>
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
                  {t("previewTitle")} ({extractedNeeds.length})
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

              {extractedNeeds.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {t("noNeedsFound")}
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/4">
                          {tCommon("needTitleColumn")}
                        </TableHead>
                        <TableHead className="w-1/3">
                          {tCommon("needStatementColumn")}
                        </TableHead>
                        <TableHead>{tCommon("governorateColumn")}</TableHead>
                        <TableHead>{tCommon("referenceIdColumn")}</TableHead>
                        <TableHead className="w-12">{tCommon("actionsColumn")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extractedNeeds.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="align-top">
                            <Input
                              value={item.title}
                              onChange={(e) =>
                                updateNeedField(item.id, "title", e.target.value)
                              }
                              className="text-xs"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Textarea
                              value={item.statement}
                              onChange={(e) =>
                                updateNeedField(item.id, "statement", e.target.value)
                              }
                              rows={2}
                              className="resize-none text-xs"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              value={item.village ?? ""}
                              onChange={(e) =>
                                updateNeedField(item.id, "village", e.target.value)
                              }
                              placeholder="Governorate/Village"
                              className="text-xs"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Input
                              value={item.referenceId ?? ""}
                              onChange={(e) =>
                                updateNeedField(item.id, "referenceId", e.target.value)
                              }
                              placeholder="Ref ID"
                              className="text-xs"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeNeed(item.id)}
                              className="text-destructive hover:bg-destructive/10 size-8"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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
                  <p className="text-muted-foreground text-xs">
                    {tCommon("otherFailures")}
                  </p>
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
