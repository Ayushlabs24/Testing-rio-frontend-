"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  FileText,
  AlertTriangle,
  Eye,
  Sparkles,
  CheckCircle2,
  Trash2,
  FileCheck,
  Plus,
  RefreshCw,
  Edit3,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { usePermission } from "@/hooks/use-permission";
import type { AppLocale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format-date";
import {
  evidenceDocumentsService,
  EvidenceDocument,
  EvidenceDocumentSummary,
} from "@/services/evidence/evidence-documents.service";
import { reportsService } from "@/services/reports/reports.service";

interface DocumentBasedSummaryTabProps {
  studyId: string;
  needId: string;
}

type TFunc = ReturnType<typeof useTranslations>;

const DOC_TYPE_KEY: Record<string, string> = {
  FIELD_REPORT: "fieldReport",
  ASSESSMENT_NOTE: "assessmentNote",
  INTERVIEW_TRANSCRIPT: "interviewTranscript",
  STATISTICAL_TABLE: "statisticalTable",
};

function docTypeLabel(type: string, t: TFunc): string {
  const key = DOC_TYPE_KEY[type];
  return key ? t(`docTypes.${key}` as Parameters<TFunc>[0]) : type;
}

const STATUS_KEY: Record<string, string> = {
  UPLOADED: "uploaded",
  PARSING: "parsing",
  PARSED: "parsed",
  FAILED: "failed",
  NOT_GENERATED: "notGenerated",
  DRAFT: "draft",
  OFFICER_CONFIRMED: "officerConfirmed",
  STALE: "stale",
  SUPERSEDED: "superseded",
};

function statusLabel(status: string, t: TFunc): string {
  const key = STATUS_KEY[status];
  return key ? t(`status.${key}` as Parameters<TFunc>[0]) : status;
}

function formatTimestamp(value: string | null | undefined, locale: AppLocale): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : formatDateTime(parsed, locale);
}

/** Summary payloads are stored as JSON but have historically also arrived as strings. */
function parseSummaryJson(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function DocumentBasedSummaryTab({
  studyId,
  needId,
}: DocumentBasedSummaryTabProps) {
  const t = useTranslations("EvidenceDocuments");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const canWrite = usePermission("dataCollection", "write");
  // Bug fix (Aug 14 audit): uploading is a create action, not an edit of
  // something that already exists — same mismatch class as the two other
  // Evidence pages fixed earlier (canWrite stays correct for toggle-
  // inclusion/delete of an already-uploaded document, both below).
  const canCreate = usePermission("dataCollection", "create");
  // Client-confirmed (Aug 14): AI Evidence Summary generation is Data
  // Analyst's action — was aiReview:write (shared with Research Officer's
  // unrelated Need-classification-trigger use of that flag).
  // priorityScoring:write is the precise gate.
  const canAi = usePermission("priorityScoring", "write");
  const canCreateReport = usePermission("reportsDashboards", "create");

  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    documentType: "FIELD_REPORT",
    sourceReferenceId: "",
    collectedDate: new Date().toISOString().substring(0, 10),
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [unsupportedError, setUnsupportedError] = useState<string | null>(null);

  // Document details / extracted text drawer state
  const [selectedDoc, setSelectedDoc] = useState<EvidenceDocument | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Summary generation / edit modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [activeDocForSummary, setActiveDocForSummary] = useState<EvidenceDocument | null>(
    null,
  );
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [currentSummary, setCurrentSummary] = useState<EvidenceDocumentSummary | null>(
    null,
  );
  const [editedSummaryJson, setEditedSummaryJson] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const [confirmingSummary, setConfirmingSummary] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Read-only view of one previously generated summary, picked from the
  // summaries list below the documents table.
  const [viewSummary, setViewSummary] = useState<{
    summary: EvidenceDocumentSummary;
    doc: EvidenceDocument;
  } | null>(null);

  // Which document's original file is currently being fetched, so the open
  // link can show progress without blocking the rest of the UI.
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    try {
      const docsData = await evidenceDocumentsService.listDocuments(studyId);
      setDocuments(docsData);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load evidence documents data.";
      setLoadError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [studyId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadData();
      }
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !selectedFile) return;

    setUploading(true);
    setUnsupportedError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", uploadForm.title);
    formData.append("documentType", uploadForm.documentType);
    formData.append("sourceReferenceId", uploadForm.sourceReferenceId);
    formData.append("collectedDate", uploadForm.collectedDate);
    formData.append("linkedNeedId", needId);
    if (uploadForm.description) formData.append("description", uploadForm.description);

    try {
      const doc = await evidenceDocumentsService.uploadDocument(studyId, formData);
      if (doc.parsingStatus === "FAILED") {
        setUnsupportedError(doc.parseError || t("unsupportedFileWarning"));
      } else {
        setUploadDialogOpen(false);
        setUploadForm({
          title: "",
          documentType: "FIELD_REPORT",
          sourceReferenceId: "",
          collectedDate: new Date().toISOString().substring(0, 10),
          description: "",
        });
        setSelectedFile(null);
      }
      await loadData();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : t("unsupportedFileWarning");
      setUnsupportedError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleInclusion = async (docId: string, currentVal: boolean) => {
    if (!canWrite) return;
    setActionError(null);
    try {
      await evidenceDocumentsService.toggleInclusion(studyId, docId, !currentVal);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, isIncludedInCombinedReport: !currentVal } : d,
        ),
      );
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update report inclusion.";
      setActionError(errorMsg);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!canWrite) return;
    if (!confirm(t("deleteConfirm"))) return;
    setActionError(null);
    try {
      await evidenceDocumentsService.deleteDocument(studyId, docId);
      await loadData();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete evidence document.";
      setActionError(errorMsg);
    }
  };

  const handleOpenDrawer = async (doc: EvidenceDocument) => {
    try {
      const fullDoc = await evidenceDocumentsService.getDocumentDetails(studyId, doc.id);
      setSelectedDoc(fullDoc);
      setDrawerOpen(true);
    } catch {
      setSelectedDoc(doc);
      setDrawerOpen(true);
    }
  };

  /**
   * Opens the original uploaded file in a new tab. The bytes have to be fetched
   * as a blob (cross-origin API, cookie session) so we hand the browser an
   * object URL rather than the endpoint itself. If the popup is blocked we fall
   * back to saving the file, so the click is never silently a no-op.
   */
  const handleOpenOriginalFile = async (doc: EvidenceDocument) => {
    setOpeningFileId(doc.id);
    setActionError(null);
    try {
      const blob = await evidenceDocumentsService.getDocumentFileBlob(studyId, doc.id);
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = doc.fileName;
        anchor.click();
      }
      // Give the new tab time to read the blob before dropping the handle.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to open the original document.";
      setActionError(errorMsg);
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleGenerateSummary = async (doc: EvidenceDocument) => {
    if (!canAi) return;
    setActionError(null);
    setActiveDocForSummary(doc);
    setSummaryModalOpen(true);
    setGeneratingSummary(true);
    try {
      const summary = await evidenceDocumentsService.generateDocumentSummary(
        studyId,
        doc.id,
      );
      setCurrentSummary(summary);
      setEditedSummaryJson(summary.officerEditedOutputJson || summary.aiOutputJson);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to generate AI Document Summary.";
      setActionError(errorMsg);
      setSummaryModalOpen(false);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleConfirmSummary = async () => {
    if (!canAi || !currentSummary || !activeDocForSummary) return;
    setActionError(null);
    setConfirmingSummary(true);
    try {
      if (editingSummary && editedSummaryJson) {
        await evidenceDocumentsService.updateDocumentSummary(
          studyId,
          activeDocForSummary.id,
          currentSummary.id,
          editedSummaryJson,
        );
      }
      const confirmed = await evidenceDocumentsService.confirmDocumentSummary(
        studyId,
        activeDocForSummary.id,
        currentSummary.id,
      );
      setCurrentSummary(confirmed);
      setEditingSummary(false);
      await loadData();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to confirm document summary.";
      setActionError(errorMsg);
    } finally {
      setConfirmingSummary(false);
    }
  };

  const handleGenerateDocReport = async () => {
    if (!canCreateReport) return;
    setActionError(null);
    setGeneratingReport(true);
    try {
      const report = await reportsService.create({
        reportType: "RPT17",
        studyId,
      });
      router.push(`/reports/${report.id}`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to generate Document-Based Report.";
      setActionError(errorMsg);
    } finally {
      setGeneratingReport(false);
    }
  };

  const hasConfirmedDocSummary = documents.some(
    (d) => d.summaries && d.summaries.some((s) => s.status === "OFFICER_CONFIRMED"),
  );

  // Every generated summary across every document, newest first, each paired
  // with the document it came from so the list can show its title/reference.
  const allSummaries = documents
    .flatMap((doc) => (doc.summaries ?? []).map((summary) => ({ summary, doc })))
    .sort(
      (a, b) =>
        new Date(b.summary.generatedAt).getTime() -
        new Date(a.summary.generatedAt).getTime(),
    );

  return (
    <div className="space-y-6">
      {/* Unsupported File Warning Banner */}
      <div className="border-warning/40 bg-warning/10 text-foreground flex items-center justify-between rounded-lg border p-4 text-xs font-medium">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{t("unsupportedFileWarning")}</span>
        </div>
        {hasConfirmedDocSummary && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateDocReport}
            disabled={!canCreateReport || generatingReport}
            className="flex items-center gap-2"
          >
            <FileCheck className="size-4" />
            {t("generateReportButton")}
          </Button>
        )}
      </div>

      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground text-xs">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => setUploadDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="size-4" />
            {t("uploadButton")}
          </Button>
        )}
      </div>

      {actionError ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 rounded-lg border p-4 text-sm"
        >
          <p className="font-semibold">{t("actionErrorTitle")}</p>
          <p className="text-muted-foreground mt-1">{actionError}</p>
        </div>
      ) : null}

      {/* Documents Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {t("loadingDocuments")}
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 m-4 flex items-center justify-between gap-4 rounded-lg border p-4 text-sm"
            >
              <div>
                <p className="font-semibold">{t("loadErrorTitle")}</p>
                <p className="text-muted-foreground mt-1">{loadError}</p>
              </div>
              <Button variant="outline" onClick={() => void loadData()} className="gap-2">
                <RefreshCw className="size-4" />
                {t("retry")}
              </Button>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {t("noDocuments")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.title")}</TableHead>
                  <TableHead>{t("table.documentType")}</TableHead>
                  <TableHead>{t("table.parsingStatus")}</TableHead>
                  <TableHead>{t("table.summaryStatus")}</TableHead>
                  <TableHead>{t("table.includeInReport")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const latestSummary = doc.summaries?.[0];
                  const summaryStatus = latestSummary
                    ? latestSummary.status
                    : "NOT_GENERATED";

                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-semibold">{doc.title}</p>
                          <p className="text-muted-foreground text-xs">
                            {t("refFileName", {
                              fileName: doc.fileName,
                              ref: doc.sourceReferenceId,
                            })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {docTypeLabel(doc.documentType, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            doc.parsingStatus === "PARSED"
                              ? "secondary"
                              : doc.parsingStatus === "FAILED"
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {statusLabel(doc.parsingStatus, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            summaryStatus === "OFFICER_CONFIRMED"
                              ? "default"
                              : summaryStatus === "STALE"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {statusLabel(summaryStatus, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={doc.isIncludedInCombinedReport}
                          disabled={!canWrite}
                          onCheckedChange={() =>
                            handleToggleInclusion(doc.id, doc.isIncludedInCombinedReport)
                          }
                        />
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenDrawer(doc)}
                        >
                          <Eye className="size-4" />
                        </Button>

                        {doc.parsingStatus === "PARSED" && canAi && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateSummary(doc)}
                            className="gap-1"
                          >
                            <Sparkles className="size-3.5" />
                            {t("sections.summary")}
                          </Button>
                        )}

                        {canWrite && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(doc.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/*
        Generated AI evidence summaries, one row per summary across every
        document in the study. This replaces the old inline "Extracted Text
        Overview" dump — the raw text now lives behind each row's eye button in
        the document table, which is where you also get a link to the original
        file.
      */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="text-primary size-5" />
            {t("summaries.heading")}
            {allSummaries.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {allSummaries.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allSummaries.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {t("summaries.empty")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("summaries.document")}</TableHead>
                  <TableHead>{t("summaries.status")}</TableHead>
                  <TableHead>{t("summaries.generated")}</TableHead>
                  <TableHead>{t("summaries.model")}</TableHead>
                  <TableHead className="text-right">{t("summaries.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSummaries.map(({ summary, doc }) => (
                  <TableRow key={summary.id}>
                    <TableCell>
                      <p className="text-sm font-semibold">{doc.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {t("refFileName", {
                          fileName: doc.fileName,
                          ref: doc.sourceReferenceId,
                        })}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          summary.status === "OFFICER_CONFIRMED"
                            ? "default"
                            : summary.status === "STALE"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {statusLabel(summary.status, t)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTimestamp(summary.generatedAt, locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {summary.modelName}
                      <span className="block text-[10px]">{summary.promptVersion}</span>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("summaries.viewAriaLabel", { title: doc.title })}
                        onClick={() => setViewSummary({ summary, doc })}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* UPLOAD DIALOG */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("uploadButton")}</DialogTitle>
            <DialogDescription>{t("uploadDialogDescription")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            {unsupportedError && (
              <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-xs">
                {unsupportedError}
              </div>
            )}

            <div>
              <Label>{t("fields.title")} *</Label>
              <Input
                required
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder={t("placeholders.title")}
              />
            </div>

            <div>
              <Label>{t("fields.file")} *</Label>
              <Input
                type="file"
                required
                accept=".txt,.docx,.pdf,.csv,.xlsx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("fields.documentType")}</Label>
                <Select
                  value={uploadForm.documentType}
                  onValueChange={(val) =>
                    setUploadForm({ ...uploadForm, documentType: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIELD_REPORT">
                      {t("docTypes.fieldReport")}
                    </SelectItem>
                    <SelectItem value="ASSESSMENT_NOTE">
                      {t("docTypes.assessmentNote")}
                    </SelectItem>
                    <SelectItem value="INTERVIEW_TRANSCRIPT">
                      {t("docTypes.interviewTranscript")}
                    </SelectItem>
                    <SelectItem value="STATISTICAL_TABLE">
                      {t("docTypes.statisticalTable")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("fields.sourceReferenceId")} *</Label>
                <Input
                  required
                  value={uploadForm.sourceReferenceId}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, sourceReferenceId: e.target.value })
                  }
                  placeholder={t("placeholders.refId")}
                />
              </div>
            </div>

            <div>
              <Label>{t("fields.collectedDate")} *</Label>
              <Input
                type="date"
                required
                value={uploadForm.collectedDate}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, collectedDate: e.target.value })
                }
              />
            </div>

            <div>
              <Label>{t("fields.description")}</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, description: e.target.value })
                }
                placeholder={t("placeholders.description")}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? t("uploading") : t("uploadSubmit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT DETAILS & EXTRACTED TEXT DRAWER */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{selectedDoc?.title}</SheetTitle>
            <SheetDescription>
              {t("refType", {
                ref: selectedDoc?.sourceReferenceId ?? "",
                type: selectedDoc ? docTypeLabel(selectedDoc.documentType, t) : "",
              })}
            </SheetDescription>
          </SheetHeader>

          {selectedDoc && (
            <div className="mt-6 space-y-6">
              {selectedDoc.summaries && selectedDoc.summaries.length > 0 && (
                <div>
                  <h3 className="text-primary mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="size-4" />
                    {t("savedAiSummary")}
                  </h3>
                  <div className="bg-card space-y-3 rounded-lg border p-4 text-xs">
                    {(() => {
                      const latest = selectedDoc.summaries[0];
                      const json = parseSummaryJson(
                        latest.officerEditedOutputJson || latest.aiOutputJson,
                      );
                      return (
                        <>
                          <Badge
                            variant={
                              latest.status === "OFFICER_CONFIRMED"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {t("statusLabel", { status: statusLabel(latest.status, t) })}
                          </Badge>
                          <p className="text-muted-foreground leading-relaxed">
                            {String(json?.summary || t("summarySavedFallback"))}
                          </p>
                          {Array.isArray(json?.keyFindings) &&
                            json.keyFindings.length > 0 && (
                              <div className="border-t pt-2">
                                <p className="text-foreground mb-1 font-semibold">
                                  {t("sections.keyFindings")}
                                </p>
                                <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                                  {json.keyFindings.map(
                                    (f: Record<string, unknown> | string, i: number) => (
                                      <li key={i}>
                                        {typeof f === "string"
                                          ? f
                                          : String(f.finding || "")}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/*
                Always shown, even once a summary exists — the extracted text is
                the evidence the summary was derived from, so reviewers need it
                side by side rather than either/or.
              */}
              <div>
                <h3 className="text-foreground mb-2 text-sm font-semibold">
                  {t("drawer.extractedText")}
                </h3>
                <div className="bg-muted/30 max-h-80 overflow-y-auto rounded-lg border p-4 font-mono text-xs whitespace-pre-wrap">
                  {selectedDoc.extractedText || t("noTextExtracted")}
                </div>
                {/* Link to the source file, at the end of the extracted text. */}
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 h-auto gap-1.5 px-0"
                  disabled={openingFileId === selectedDoc.id}
                  onClick={() => handleOpenOriginalFile(selectedDoc)}
                >
                  <ExternalLink className="size-3.5" />
                  {openingFileId === selectedDoc.id
                    ? t("openingFile")
                    : t("openOriginalDocument", { fileName: selectedDoc.fileName })}
                </Button>
              </div>

              {selectedDoc.chunks && selectedDoc.chunks.length > 0 && (
                <div>
                  <h3 className="text-foreground mb-2 text-sm font-semibold">
                    {t("orderedChunksHeading", { count: selectedDoc.chunks.length })}
                  </h3>
                  <div className="space-y-2">
                    {selectedDoc.chunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="bg-card rounded-md border p-3 text-xs"
                      >
                        <p className="text-primary font-semibold">
                          {chunk.sectionReference ||
                            t("chunkFallback", { index: chunk.chunkIndex + 1 })}
                        </p>
                        <p className="text-muted-foreground mt-1 line-clamp-3">
                          {chunk.chunkText}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* SUMMARY MODAL */}
      <Dialog open={summaryModalOpen} onOpenChange={setSummaryModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-primary size-5" />
              {t("aiDocumentSummaryTitle", { title: activeDocForSummary?.title ?? "" })}
            </DialogTitle>
          </DialogHeader>

          {generatingSummary ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
              <RefreshCw className="text-primary size-6 animate-spin" />
              {t("analyzingSummary")}
            </div>
          ) : currentSummary ? (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between border-b pb-3">
                <Badge
                  variant={
                    currentSummary.status === "OFFICER_CONFIRMED"
                      ? "default"
                      : "secondary"
                  }
                >
                  {t("statusLabel", { status: statusLabel(currentSummary.status, t) })}
                </Badge>
                {canAi && currentSummary.status !== "OFFICER_CONFIRMED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingSummary(!editingSummary)}
                  >
                    <Edit3 className="mr-1 size-3.5" />
                    {editingSummary ? t("preview") : t("editDraft")}
                  </Button>
                )}
              </div>

              {editingSummary ? (
                <div className="space-y-4">
                  <div>
                    <Label>{t("sections.executiveSummary")}</Label>
                    <Textarea
                      rows={4}
                      value={String(editedSummaryJson?.summary || "")}
                      onChange={(e) =>
                        setEditedSummaryJson({
                          ...editedSummaryJson,
                          summary: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5 text-xs">
                  {/* text-foreground, not text-info-foreground: the latter is
                      near-white (palette-neutral-50), readable only on a solid
                      bg-info fill — on this 10% tint it disappears. */}
                  {Boolean(editedSummaryJson?.evidenceNote) && (
                    <div className="border-info/40 bg-info/10 text-foreground rounded-md border p-3 text-[11px] font-medium">
                      {String(editedSummaryJson?.evidenceNote || "")}
                    </div>
                  )}

                  <div>
                    <h4 className="text-foreground mb-1 text-sm font-semibold">
                      {t("sections.summary")}
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      {String(editedSummaryJson?.summary || "")}
                    </p>
                  </div>

                  {Array.isArray(editedSummaryJson?.keyFindings) &&
                    (editedSummaryJson.keyFindings as unknown[]).length > 0 && (
                      <div>
                        <h4 className="text-foreground mb-2 text-sm font-semibold">
                          {t("sections.keyFindings")}
                        </h4>
                        <div className="space-y-2">
                          {(
                            editedSummaryJson.keyFindings as (
                              Record<string, unknown> | string
                            )[]
                          ).map((f: Record<string, unknown> | string, i: number) => (
                            <div key={i} className="bg-card rounded-md border p-2.5">
                              <p className="text-foreground font-medium">
                                {typeof f === "string" ? f : String(f.finding || "")}
                              </p>
                              {typeof f !== "string" && (
                                <p className="text-muted-foreground mt-1 text-[10px]">
                                  Ref: {String(f.sourceReferenceId || "")} •{" "}
                                  {String(f.pageOrSection || "")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {Array.isArray(editedSummaryJson?.themes) &&
                    (editedSummaryJson.themes as unknown[]).length > 0 && (
                      <div>
                        <h4 className="text-foreground mb-2 text-sm font-semibold">
                          {t("sections.themes")}
                        </h4>
                        <div className="space-y-2">
                          {(
                            editedSummaryJson.themes as (
                              Record<string, unknown> | string
                            )[]
                          ).map((t: Record<string, unknown> | string, i: number) => (
                            <div key={i} className="bg-muted/20 rounded-md border p-2.5">
                              <p className="text-primary font-semibold">
                                {typeof t === "string" ? t : String(t.theme || "")}
                              </p>
                              {typeof t !== "string" && (
                                <p className="text-muted-foreground mt-0.5">
                                  {String(t.description || "")}
                                </p>
                              )}
                              {typeof t !== "string" && (
                                <p className="text-muted-foreground mt-1 text-[10px]">
                                  Ref: {String(t.sourceReferenceId || "")} •{" "}
                                  {String(t.pageOrSection || "")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {Array.isArray(editedSummaryJson?.supportingStatements) &&
                    (editedSummaryJson.supportingStatements as unknown[]).length > 0 && (
                      <div>
                        <h4 className="text-foreground mb-2 text-sm font-semibold">
                          {t("sections.supportingStatements")}
                        </h4>
                        <div className="space-y-2">
                          {(
                            editedSummaryJson.supportingStatements as (
                              Record<string, unknown> | string
                            )[]
                          ).map((s: Record<string, unknown> | string, i: number) => (
                            <div
                              key={i}
                              className="border-primary bg-muted/20 rounded-r border-l-2 py-1 pl-3"
                            >
                              <p className="text-foreground font-medium">
                                &quot;
                                {typeof s === "string" ? s : String(s.statement || "")}
                                &quot;
                              </p>
                              {typeof s !== "string" && (
                                <p className="text-muted-foreground mt-0.5 text-[10px]">
                                  Ref:{" "}
                                  {String(
                                    s.sourceReferenceId || s.sectionOrPageRef || "",
                                  )}{" "}
                                  • {String(s.pageOrSection || s.sectionOrPageRef || "")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {Array.isArray(editedSummaryJson?.risksOrConcerns) &&
                    (editedSummaryJson.risksOrConcerns as unknown[]).length > 0 && (
                      <div>
                        <h4 className="text-foreground mb-2 text-sm font-semibold">
                          {t("sections.risksOrConcerns")}
                        </h4>
                        <div className="space-y-2">
                          {(
                            editedSummaryJson.risksOrConcerns as (
                              Record<string, unknown> | string
                            )[]
                          ).map((r: Record<string, unknown> | string, i: number) => (
                            <div
                              key={i}
                              className="border-warning/40 bg-warning/10 text-foreground rounded-md border p-2.5"
                            >
                              <p className="font-medium">
                                {typeof r === "string" ? r : String(r.concern || "")}
                              </p>
                              {typeof r !== "string" && (
                                <p className="mt-1 text-[10px] opacity-80">
                                  Ref: {String(r.sourceReferenceId || "")} •{" "}
                                  {String(r.pageOrSection || "")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {Array.isArray(editedSummaryJson?.documentLimitations) &&
                    editedSummaryJson.documentLimitations.length > 0 && (
                      <div>
                        <h4 className="text-foreground mb-1 text-sm font-semibold">
                          {t("sections.documentLimitations")}
                        </h4>
                        <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                          {editedSummaryJson.documentLimitations.map(
                            (l: string, i: number) => (
                              <li key={i}>{l}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              {/* flex-wrap: with justify-end alone, a row too wide for the
                  dialog overflows past the START edge and the first button is
                  clipped instead of wrapping. */}
              <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
                <Button
                  onClick={handleConfirmSummary}
                  disabled={!canAi || confirmingSummary}
                  variant="outline"
                  className="gap-2"
                >
                  <CheckCircle2 className="size-4" />
                  {confirmingSummary ? t("savingSummary") : t("saveSummaryButton")}
                </Button>
                <Button
                  onClick={handleGenerateDocReport}
                  disabled={!canCreateReport || generatingReport}
                  className="gap-2"
                >
                  <FileText className="size-4" />
                  {generatingReport ? t("generatingReport") : t("generateReportButton")}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* READ-ONLY VIEW OF A PREVIOUSLY GENERATED SUMMARY */}
      <Dialog open={Boolean(viewSummary)} onOpenChange={() => setViewSummary(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="text-primary size-5" />
              {t("aiEvidenceSummaryTitle", { title: viewSummary?.doc.title ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("refGeneratedModel", {
                ref: viewSummary?.doc.sourceReferenceId ?? "",
                date: formatTimestamp(viewSummary?.summary.generatedAt, locale),
                model: viewSummary?.summary.modelName ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          {viewSummary
            ? (() => {
                const json = parseSummaryJson(
                  viewSummary.summary.officerEditedOutputJson ||
                    viewSummary.summary.aiOutputJson,
                );
                return (
                  <div className="space-y-4 text-xs">
                    <Badge
                      variant={
                        viewSummary.summary.status === "OFFICER_CONFIRMED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {t("statusLabel", {
                        status: statusLabel(viewSummary.summary.status, t),
                      })}
                    </Badge>

                    {Boolean(json?.summary) && (
                      <p className="text-muted-foreground leading-relaxed">
                        {String(json?.summary || "")}
                      </p>
                    )}

                    {Array.isArray(json?.keyFindings) && json.keyFindings.length > 0 && (
                      <div className="border-t pt-3">
                        <h4 className="text-foreground mb-1 text-sm font-semibold">
                          {t("sections.keyFindings")}
                        </h4>
                        <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                          {json.keyFindings.map(
                            (f: Record<string, unknown> | string, i: number) => (
                              <li key={i}>
                                {typeof f === "string" ? f : String(f.finding || "")}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(json?.themes) && json.themes.length > 0 && (
                      <div className="border-t pt-3">
                        <h4 className="text-foreground mb-1 text-sm font-semibold">
                          {t("sections.themes")}
                        </h4>
                        <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                          {json.themes.map(
                            (th: Record<string, unknown> | string, i: number) => (
                              <li key={i}>
                                {typeof th === "string" ? th : String(th.theme || "")}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    {Array.isArray(json?.risksOrConcerns) &&
                      json.risksOrConcerns.length > 0 && (
                        <div className="border-t pt-3">
                          <h4 className="text-foreground mb-1 text-sm font-semibold">
                            {t("sections.risksOrConcerns")}
                          </h4>
                          <ul className="text-muted-foreground list-disc space-y-0.5 pl-4">
                            {json.risksOrConcerns.map(
                              (r: Record<string, unknown> | string, i: number) => (
                                <li key={i}>
                                  {typeof r === "string" ? r : String(r.concern || "")}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                    {Boolean(json?.evidenceNote) && (
                      <p className="text-muted-foreground border-t pt-3 italic">
                        {String(json?.evidenceNote || "")}
                      </p>
                    )}

                    {/* Link to the source file, at the end of the summary. */}
                    <div className="border-t pt-3">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto gap-1.5 px-0"
                        disabled={openingFileId === viewSummary.doc.id}
                        onClick={() => handleOpenOriginalFile(viewSummary.doc)}
                      >
                        <ExternalLink className="size-3.5" />
                        {openingFileId === viewSummary.doc.id
                          ? t("openingFile")
                          : t("openOriginalDocument", {
                              fileName: viewSummary.doc.fileName,
                            })}
                      </Button>
                    </div>
                  </div>
                );
              })()
            : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
