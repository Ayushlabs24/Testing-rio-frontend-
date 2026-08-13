"use client";

import {
  FileText,
  Info,
  Loader2,
  RotateCw,
  Trash2,
  TriangleAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { evidenceService } from "@/services/evidence/evidence.service";
import type { Evidence } from "@/services/evidence/evidence.types";
import { needsService } from "@/services/needs/needs.service";
import { EVIDENCE_EDITABLE_STATUSES } from "@/services/needs/needs.types";

// RIO-FR-Add-01: mirrors the backend's own allowlist/limits exactly (see
// EvidenceStorageService) — rejecting client-side is just a faster,
// friendlier version of the same server-side rule.
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".csv",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_STUDY = 10;

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

function fileTypeLabel(fileName: string): string {
  const ext = extensionOf(fileName).replace(".", "");
  return ext ? ext.toUpperCase() : "—";
}

// The backend has no endpoint that serves an evidence file's actual bytes
// back (upload/list/submit/delete only) — a real content thumbnail isn't
// achievable yet. This is a visual stand-in: a colored file-type badge so
// the type is scannable at a glance, not a rendered preview of the file.
const FILE_TYPE_BADGE_CLASS: Record<string, string> = {
  pdf: "bg-destructive/15 text-destructive",
  csv: "bg-badge-success text-badge-success-foreground",
  xls: "bg-badge-success text-badge-success-foreground",
  xlsx: "bg-badge-success text-badge-success-foreground",
  doc: "bg-badge-primary text-badge-primary-foreground",
  docx: "bg-badge-primary text-badge-primary-foreground",
  jpg: "bg-badge-secondary text-badge-secondary-foreground",
  jpeg: "bg-badge-secondary text-badge-secondary-foreground",
  png: "bg-badge-secondary text-badge-secondary-foreground",
};

function FileTypeBadge({ fileName }: { fileName: string }) {
  const ext = extensionOf(fileName).replace(".", "");
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-wide",
        FILE_TYPE_BADGE_CLASS[ext] ?? "bg-muted text-muted-foreground",
      )}
    >
      {ext ? ext.toUpperCase() : <FileText className="size-4" />}
    </span>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface QueueItem {
  localId: string;
  file: File;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
  // Client-side validation failures (wrong type, too large, over the
  // per-need limit) never attempted an upload — retrying them would just
  // fail the same way again, so only a real upload failure (network/server
  // error, caught in startUpload's .catch) is retryable.
  retryable?: boolean;
}

function DropzoneAndQueue({
  needId,
  existingCount,
  onUploaded,
}: {
  needId: string;
  existingCount: number;
  onUploaded: (evidence: Evidence) => void;
}) {
  const t = useTranslations("app.evidence");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controllersRef = useRef(new Map<string, AbortController>());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const updateItem = (localId: string, patch: Partial<QueueItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    );
  };

  const startUpload = (item: QueueItem) => {
    updateItem(item.localId, { status: "uploading", progress: 0, error: undefined });
    const controller = new AbortController();
    controllersRef.current.set(item.localId, controller);
    evidenceService
      .upload(needId, item.file, {
        signal: controller.signal,
        onProgress: (percent) => updateItem(item.localId, { progress: percent }),
      })
      .then((created) => {
        controllersRef.current.delete(item.localId);
        onUploaded(created);
        setQueue((prev) => prev.filter((q) => q.localId !== item.localId));
      })
      .catch((error) => {
        controllersRef.current.delete(item.localId);
        updateItem(item.localId, {
          status: "error",
          error: error instanceof ApiError ? error.message : t("uploadFailed"),
          retryable: true,
        });
      });
  };

  const addFiles = (files: FileList | File[]) => {
    const pendingCount = queue.filter((q) => q.status !== "error").length;
    let runningTotal = existingCount + pendingCount;

    const newItems: QueueItem[] = [];
    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID();
      if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
        newItems.push({
          localId,
          file,
          status: "error",
          progress: 0,
          error: t("invalidType", { name: file.name }),
          retryable: false,
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        newItems.push({
          localId,
          file,
          status: "error",
          progress: 0,
          error: t("fileTooLarge", { name: file.name }),
          retryable: false,
        });
        continue;
      }
      if (runningTotal + 1 > MAX_FILES_PER_STUDY) {
        newItems.push({
          localId,
          file,
          status: "error",
          progress: 0,
          error: t("fileLimitReached", { max: MAX_FILES_PER_STUDY }),
          retryable: false,
        });
        continue;
      }
      runningTotal += 1;
      newItems.push({ localId, file, status: "uploading", progress: 0 });
    }
    setQueue((prev) => [...prev, ...newItems]);
    for (const item of newItems) {
      if (item.status === "uploading") startUpload(item);
    }
  };

  const removeItem = (localId: string) => {
    controllersRef.current.get(localId)?.abort();
    controllersRef.current.delete(localId);
    setQueue((prev) => prev.filter((item) => item.localId !== localId));
  };

  const retryItem = (localId: string) => {
    const item = queue.find((q) => q.localId === localId);
    if (item) startUpload(item);
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDraggingOver(false);
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "border-input flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          isDraggingOver ? "border-ring bg-muted/50" : "hover:bg-muted/30",
        )}
      >
        <UploadCloud className="text-muted-foreground size-8" />
        <p className="text-foreground text-sm font-medium">{t("dropzoneTitle")}</p>
        <Button type="button" variant="outline" size="sm" className="mt-1">
          {t("browseButton")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("allowedTypesHint")}</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              addFiles(event.target.files);
            }
            event.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 ? (
        <ul className="space-y-2">
          {queue.map((item) => (
            <li
              key={item.localId}
              className="border-border flex items-center gap-3 rounded-lg border p-3"
            >
              <FileText className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {item.file.name}
                </p>
                {item.status === "uploading" ? (
                  <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : item.status === "error" ? (
                  <p className="text-destructive mt-1 text-xs">{item.error}</p>
                ) : null}
              </div>
              {item.status === "uploading" ? (
                <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
              ) : null}
              {item.status === "error" && item.retryable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("retry")}
                  onClick={() => retryItem(item.localId)}
                >
                  <RotateCw className="size-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("remove")}
                onClick={() => removeItem(item.localId)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeleteEvidenceAlert({
  item,
  onDeleted,
}: {
  item: Evidence;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("app.evidence");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await evidenceService.remove(item.id);
      onDeleted(item.id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("delete")}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteDescription", { name: item.fileName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EvidenceUploadScreen({ studyId, needId }: { studyId: string; needId: string }) {
  const t = useTranslations("app.evidence");
  const locale = useLocale();
  // A Reviewer/Approver only holds `dataCollection: read` (see role-matrix.ts)
  // — they can see what's been uploaded but never add/replace/remove it,
  // regardless of the Need's own status-based lock below.
  const canWrite = usePermission("dataCollection", "write");
  // Bug fix (Aug 13 audit): uploading is a create action, not an edit of
  // something that already exists — the dropzone below was gated on
  // `write` (used correctly for Delete further down this file), which
  // happens to equal `create` for every role today but is the same class
  // of mismatch as the Users page's Create button bug. Fixed for
  // correctness before a future permission change silently breaks it.
  const canCreate = usePermission("dataCollection", "create");
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  // Evidence stays editable slightly longer than the Need itself (see
  // EVIDENCE_EDITABLE_STATUSES's doc comment) — through ai_classified, not
  // just up to it. An Approver must Reject on the AI Review screen to
  // re-open editing once locked.
  const [locked, setLocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Names of files the backend flagged as duplicates as they were uploaded.
  // Advisory only — those uploads succeeded and their rows are in the list.
  // Held here rather than on the row because the flag exists only on the
  // upload response; a reload legitimately forgets it.
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([evidenceService.listByNeed(needId), needsService.getById(needId)])
      .then(([list, need]) => {
        if (cancelled) return;
        setEvidence(list);
        setLocked(!EVIDENCE_EDITABLE_STATUSES.includes(need.status));
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiError ? error.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId]);

  const sortedEvidence = useMemo(
    () =>
      [...(evidence ?? [])].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      ),
    [evidence],
  );

  return (
    <PageContainer>
      <div className="mb-6 flex justify-start">
        <BackButton
          href={`/studies/${studyId}/needs/${needId}`}
          label={t("backToStudy")}
        />
      </div>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="border-info/30 bg-info/10 mb-6 flex items-start gap-3 rounded-lg border p-4">
        <Info className="text-info mt-0.5 size-4 shrink-0" />
        <p className="text-foreground text-sm leading-relaxed">
          {t("privacyDisclaimer")}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          {!canCreate ? (
            <div
              role="status"
              className="bg-muted text-muted-foreground rounded-md border p-3 text-sm"
            >
              {t("readOnlyNotice")}
            </div>
          ) : locked ? (
            <div
              role="status"
              className="bg-muted text-muted-foreground rounded-md border p-3 text-sm"
            >
              {t("lockedNotice")}
            </div>
          ) : (
            <DropzoneAndQueue
              needId={needId}
              existingCount={sortedEvidence.length}
              onUploaded={(created) => {
                setEvidence((prev) => [created, ...(prev ?? [])]);
                if (created.isDuplicate) {
                  setDuplicateNames((prev) =>
                    prev.includes(created.fileName) ? prev : [...prev, created.fileName],
                  );
                }
              }}
            />
          )}

          {duplicateNames.length > 0 ? (
            <div
              role="status"
              className="border-warning/30 bg-warning/10 flex items-start gap-3 rounded-lg border p-4"
            >
              <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-foreground text-sm leading-relaxed">
                  {t("duplicateNotice", { count: duplicateNames.length })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {duplicateNames.join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateNames([])}
                aria-label={t("dismissDuplicateNotice")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          <div>
            <h2 className="text-foreground mb-3 text-sm font-semibold">
              {t("listTitle")}
            </h2>

            {loadError ? (
              <p className="text-destructive text-sm">{loadError}</p>
            ) : evidence === null ? (
              <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t("loading")}
              </div>
            ) : sortedEvidence.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-muted-foreground text-sm">{t("empty")}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t("emptyHint")}</p>
              </div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{t("previewColumn")}</TableHead>
                      <TableHead>{t("fileNameColumn")}</TableHead>
                      <TableHead>{t("fileTypeColumn")}</TableHead>
                      <TableHead>{t("fileSizeColumn")}</TableHead>
                      <TableHead>{t("uploadedByColumn")}</TableHead>
                      <TableHead>{t("uploadedAtColumn")}</TableHead>
                      <TableHead>{t("statusColumn")}</TableHead>
                      <TableHead className="text-right">{t("actionsColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEvidence.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <FileTypeBadge fileName={item.fileName} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-medium">
                          {item.fileName}
                        </TableCell>
                        <TableCell>{fileTypeLabel(item.fileName)}</TableCell>
                        <TableCell>{formatFileSize(item.fileSize)}</TableCell>
                        <TableCell>{item.uploadedByName ?? item.uploadedBy}</TableCell>
                        <TableCell>
                          {new Date(item.uploadedAt).toLocaleString(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "border-transparent",
                              locked
                                ? "bg-badge-success text-badge-success-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {locked ? t("statusSubmitted") : t("statusUploaded")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {!canWrite ? null : locked ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {/* Wrapper span: a disabled button emits no
                                  pointer events, so the tooltip would never
                                  open if it were the trigger itself. */}
                                <span className="inline-flex">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled
                                    aria-label={t("deleteLockedHint")}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t("deleteLockedHint")}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <DeleteEvidenceAlert
                              item={item}
                              onDeleted={(id) =>
                                setEvidence((prev) =>
                                  (prev ?? []).filter((e) => e.id !== id),
                                )
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function EvidenceUploadPage({
  params,
}: {
  params: Promise<{ id: string; needId: string }>;
}) {
  const { id: studyId, needId } = use(params);

  return (
    <PermissionGuard module="dataCollection" action="read">
      <EvidenceUploadScreen studyId={studyId} needId={needId} />
    </PermissionGuard>
  );
}
