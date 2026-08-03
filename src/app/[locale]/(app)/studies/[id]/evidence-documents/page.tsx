"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Eye,
  Sparkles,
  CheckCircle2,
  Trash2,
  FileCheck,
  Plus,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { BackButton } from "@/components/common/back-button";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { studiesService } from "@/services/studies/studies.service";
import type { Study } from "@/services/studies/studies.types";
import {
  evidenceDocumentsService,
  EvidenceDocument,
  EvidenceDocumentSummary,
} from "@/services/evidence/evidence-documents.service";
import { reportsService } from "@/services/reports/reports.service";

export default function EvidenceDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studyId } = use(params);
  const t = useTranslations("EvidenceDocuments");
  const router = useRouter();

  const canWrite = usePermission("dataCollection", "write");
  const canAi = usePermission("aiReview", "write");

  const [study, setStudy] = useState<Study | null>(null);
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    documentType: "FIELD_REPORT",
    sourceReferenceId: "",
    collectedDate: new Date().toISOString().substring(0, 10),
    description: "",
    linkedDomainId: "",
    linkedKpiId: "",
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studyData, docsData] = await Promise.all([
        studiesService.getById(studyId),
        evidenceDocumentsService.listDocuments(studyId),
      ]);
      setStudy(studyData);
      setDocuments(docsData);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to load evidence documents data.";
      setError(errorMsg);
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
    if (!selectedFile) return;

    setUploading(true);
    setUnsupportedError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", uploadForm.title);
    formData.append("documentType", uploadForm.documentType);
    formData.append("sourceReferenceId", uploadForm.sourceReferenceId);
    formData.append("collectedDate", uploadForm.collectedDate);
    if (uploadForm.description) formData.append("description", uploadForm.description);
    if (uploadForm.linkedDomainId)
      formData.append("linkedDomainId", uploadForm.linkedDomainId);
    if (uploadForm.linkedKpiId) formData.append("linkedKpiId", uploadForm.linkedKpiId);

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
          linkedDomainId: "",
          linkedKpiId: "",
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
      setError(errorMsg);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this evidence document?")) return;
    try {
      await evidenceDocumentsService.deleteDocument(studyId, docId);
      await loadData();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete evidence document.";
      alert(errorMsg);
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

  const handleGenerateSummary = async (doc: EvidenceDocument) => {
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
      alert(errorMsg);
      setSummaryModalOpen(false);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleConfirmSummary = async () => {
    if (!currentSummary || !activeDocForSummary) return;
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
      alert(errorMsg);
    } finally {
      setConfirmingSummary(false);
    }
  };

  const handleGenerateDocReport = async () => {
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
      alert(errorMsg);
    } finally {
      setGeneratingReport(false);
    }
  };

  const hasConfirmedDocSummary = documents.some(
    (d) => d.summaries && d.summaries.some((s) => s.status === "OFFICER_CONFIRMED"),
  );

  return (
    <PermissionGuard module="dataCollection" action="read">
      <PageContainer>
        <div className="mb-6 flex items-center justify-between">
          <BackButton href={`/studies/${studyId}`} label={t("backToStudy")} />
          <div className="flex gap-2">
            {hasConfirmedDocSummary && (
              <Button
                variant="outline"
                onClick={handleGenerateDocReport}
                disabled={generatingReport}
                className="flex items-center gap-2"
              >
                <FileCheck className="size-4" />
                Generate Document-Based Report
              </Button>
            )}
            <Button
              onClick={() => router.push(`/studies/${studyId}/combined-report`)}
              className="flex items-center gap-2"
            >
              <Sparkles className="size-4" />
              Go to Combined Report
            </Button>
          </div>
        </div>

        <PageHeader title={t("title")} description={t("subtitle")} />

        {/* Study Context Header */}
        <Card className="border-border bg-card/60 mb-6">
          <CardContent className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("studyName")}
              </p>
              <p className="text-foreground text-base font-semibold">
                {study?.title || "..."}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("assessmentCycle")}
              </p>
              <p className="text-foreground text-base font-semibold">
                Cycle {study?.cycleNumber || 1}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("methodologyVersion")}
              </p>
              <p className="text-foreground text-base font-semibold">
                {study?.methodologyVersionId || "v1.0 Baseline"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("totalDocuments")}
              </p>
              <p className="text-foreground text-base font-semibold">
                {documents.length}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Unsupported File Warning Banner */}
        <div className="border-warning/40 bg-warning/10 text-warning-foreground mb-6 flex items-center gap-3 rounded-lg border p-4 text-xs font-medium">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{t("unsupportedFileWarning")}</span>
        </div>

        {/* Action Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">
            {t("uploadedEvidenceDocuments")}
          </h2>
          {canWrite && (
            <Button
              onClick={() => setUploadDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="size-4" />
              {t("uploadButton")}
            </Button>
          )}
        </div>

        {/* Documents Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="text-muted-foreground p-8 text-center text-sm">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="text-muted-foreground p-8 text-center text-sm">
                No supporting evidence documents uploaded yet.
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
                            <p className="font-semibold">{doc.title}</p>
                            <p className="text-muted-foreground text-xs">
                              {doc.fileName} • Ref: {doc.sourceReferenceId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.documentType}</Badge>
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
                            {doc.parsingStatus}
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
                            {summaryStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={doc.isIncludedInCombinedReport}
                            onCheckedChange={() =>
                              handleToggleInclusion(
                                doc.id,
                                doc.isIncludedInCombinedReport,
                              )
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
                              Summary
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

        {/* UPLOAD DIALOG */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("uploadButton")}</DialogTitle>
              <DialogDescription>
                Upload supporting text-based documents (.txt, .docx, text PDF, .csv,
                .xlsx).
              </DialogDescription>
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
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, title: e.target.value })
                  }
                  placeholder="e.g. Health Infrastructure Field Assessment"
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
                      <SelectItem value="FIELD_REPORT">Field Report</SelectItem>
                      <SelectItem value="ASSESSMENT_NOTE">Assessment Note</SelectItem>
                      <SelectItem value="INTERVIEW_TRANSCRIPT">
                        Interview Transcript
                      </SelectItem>
                      <SelectItem value="STATISTICAL_TABLE">Statistical Table</SelectItem>
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
                    placeholder="REF-2026-001"
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
                  placeholder="Optional brief description of evidence context..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUploadDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload & Parse"}
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
                Ref: {selectedDoc?.sourceReferenceId} • Type: {selectedDoc?.documentType}
              </SheetDescription>
            </SheetHeader>

            {selectedDoc && (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-foreground mb-2 text-sm font-semibold">
                    Extracted Text
                  </h3>
                  <div className="bg-muted/30 max-h-80 overflow-y-auto rounded-lg border p-4 font-mono text-xs whitespace-pre-wrap">
                    {selectedDoc.extractedText || "No text extracted."}
                  </div>
                </div>

                {selectedDoc.chunks && selectedDoc.chunks.length > 0 && (
                  <div>
                    <h3 className="text-foreground mb-2 text-sm font-semibold">
                      Ordered Chunks ({selectedDoc.chunks.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedDoc.chunks.map((chunk) => (
                        <div
                          key={chunk.id}
                          className="bg-card rounded-md border p-3 text-xs"
                        >
                          <p className="text-primary font-semibold">
                            {chunk.sectionReference || `Chunk #${chunk.chunkIndex + 1}`}
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
                AI Document Summary — {activeDocForSummary?.title}
              </DialogTitle>
            </DialogHeader>

            {generatingSummary ? (
              <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
                <RefreshCw className="text-primary size-6 animate-spin" />
                Analyzing extracted document text and generating qualitative summary...
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
                    Status: {currentSummary.status}
                  </Badge>
                  {canAi && currentSummary.status !== "OFFICER_CONFIRMED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingSummary(!editingSummary)}
                    >
                      <Edit3 className="mr-1 size-3.5" />
                      {editingSummary ? "Preview" : "Edit Draft"}
                    </Button>
                  )}
                </div>

                {/* Summary content viewer / editor */}
                {editingSummary ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Executive Summary</Label>
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
                  <div className="space-y-4 text-xs">
                    <div>
                      <h4 className="text-foreground mb-1 text-sm font-semibold">
                        Summary
                      </h4>
                      <p className="text-muted-foreground">
                        {String(editedSummaryJson?.summary || "")}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-foreground mb-1 text-sm font-semibold">
                        Key Findings
                      </h4>
                      <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                        {(
                          (editedSummaryJson?.keyFindings as (
                            Record<string, unknown> | string
                          )[]) || []
                        ).map((f: Record<string, unknown> | string, i: number) => (
                          <li key={i}>
                            {typeof f === "string" ? f : String(f.finding || "")}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-foreground mb-1 text-sm font-semibold">
                        Supporting Statements
                      </h4>
                      <div className="space-y-2">
                        {(
                          (editedSummaryJson?.supportingStatements as (
                            Record<string, unknown> | string
                          )[]) || []
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
                            <p className="text-muted-foreground mt-0.5 text-[10px]">
                              {typeof s !== "string"
                                ? String(s.sectionOrPageRef || "")
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {canAi && currentSummary.status !== "OFFICER_CONFIRMED" && (
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                    <Button
                      onClick={handleConfirmSummary}
                      disabled={confirmingSummary}
                      className="gap-2"
                    >
                      <CheckCircle2 className="size-4" />
                      {confirmingSummary ? "Confirming..." : "Officer Confirm Summary"}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
