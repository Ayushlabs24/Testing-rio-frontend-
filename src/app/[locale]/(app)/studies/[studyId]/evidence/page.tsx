"use client";

import {
  FileText,
  Info,
  Loader2,
  RotateCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Fragment, use, useEffect, useMemo, useRef, useState } from "react";
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
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { aiDecisionsService } from "@/services/ai-decisions/ai-decisions.service";
import type { AiDecision } from "@/services/ai-decisions/ai-decisions.types";
import { ApiError } from "@/services/api/types";
import { evidenceService } from "@/services/evidence/evidence.service";
import type { Evidence } from "@/services/evidence/evidence.types";
import { needsService } from "@/services/needs/needs.service";
import { usersService } from "@/services/users/users.service";

// RIO-FR-Add-01: mirrors the backend's own allowlist exactly (see
// EvidenceStorageService.assertAllowedExtension) — rejecting an unsupported
// file here is just a faster, friendlier version of the same rule.
const ALLOWED_EXTENSIONS = [".pdf", ".csv", ".xls", ".xlsx", ".doc", ".docx"];

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

function fileTypeLabel(fileName: string): string {
  const ext = extensionOf(fileName).replace(".", "");
  return ext ? ext.toUpperCase() : "—";
}

interface QueueItem {
  localId: string;
  file: File;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

function DropzoneAndQueue({
  studyId,
  onUploaded,
}: {
  studyId: string;
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
      .upload(studyId, item.file, {
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
        });
      });
  };

  const addFiles = (files: FileList | File[]) => {
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
        });
        continue;
      }
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
              {item.status === "error" ? (
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

// RIO-FR-003: classification reads Need + Evidence, so it can't run until
// both exist — this mirrors AiDecisionsService.classify's own NEED_NOT_FOUND/
// EVIDENCE_REQUIRED checks on the backend, just surfaced proactively instead
// of letting the user hit a 404/409 blind.
function AiClassificationSection({
  studyId,
  hasNeed,
  evidenceCount,
}: {
  studyId: string;
  hasNeed: boolean;
  evidenceCount: number;
}) {
  const t = useTranslations("app.evidence");
  const canRun = usePermission("aiReview", "write");
  const [latest, setLatest] = useState<AiDecision | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    aiDecisionsService
      .listByStudy(studyId)
      .then((list) => {
        if (!cancelled) setLatest(list[0] ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  if (!canRun) return null;

  const canClassify = hasNeed && evidenceCount > 0;

  const runClassify = async () => {
    setError(null);
    setIsRunning(true);
    try {
      const result = await aiDecisionsService.classify(studyId);
      setLatest(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("classifyError"));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="border-border border-t pt-6">
      <h2 className="text-foreground mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="size-4" />
        {t("aiClassificationTitle")}
      </h2>
      <p className="text-muted-foreground mb-3 text-xs">
        {canClassify
          ? t("aiClassificationReady")
          : !hasNeed
            ? t("aiClassificationNeedsNeed")
            : t("aiClassificationNeedsEvidence")}
      </p>

      <Button type="button" onClick={runClassify} disabled={!canClassify || isRunning}>
        {isRunning ? t("classifying") : t("runClassification")}
      </Button>

      {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}

      {latest ? (
        <div className="border-border bg-muted/30 mt-4 space-y-1 rounded-md border p-3 text-xs">
          <p className="text-muted-foreground mb-1 font-medium">
            {t("latestSuggestion")}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {Object.entries(latest.suggestion).map(([key, value]) => (
              <Fragment key={key}>
                <dt className="text-muted-foreground capitalize">{key}</dt>
                <dd className="text-foreground truncate">{String(value)}</dd>
              </Fragment>
            ))}
            <dt className="text-muted-foreground">{t("confidence")}</dt>
            <dd className="text-foreground">{Math.round(latest.confidence * 100)}%</dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceUploadScreen({ studyId }: { studyId: string }) {
  const t = useTranslations("app.evidence");
  const locale = useLocale();
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [hasNeed, setHasNeed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      evidenceService.listByStudy(studyId),
      usersService.listByOrganization().catch(() => []),
      needsService.getByStudy(studyId),
    ])
      .then(([list, users, need]) => {
        if (cancelled) return;
        setEvidence(list);
        setUserNames(Object.fromEntries(users.map((user) => [user.id, user.name])));
        setHasNeed(need !== null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiError ? error.message : t("loadError"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId]);

  const sortedEvidence = useMemo(
    () =>
      [...(evidence ?? [])].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      ),
    [evidence],
  );

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="border-info/30 bg-info/10 mb-6 flex items-start gap-3 rounded-lg border p-4">
        <Info className="text-info mt-0.5 size-4 shrink-0" />
        <p className="text-foreground text-sm leading-relaxed">
          {t("privacyDisclaimer")}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <DropzoneAndQueue
            studyId={studyId}
            onUploaded={(created) => setEvidence((prev) => [created, ...(prev ?? [])])}
          />

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("fileNameColumn")}</TableHead>
                    <TableHead>{t("fileTypeColumn")}</TableHead>
                    <TableHead>{t("uploadedByColumn")}</TableHead>
                    <TableHead>{t("uploadedAtColumn")}</TableHead>
                    <TableHead className="text-right">{t("actionsColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEvidence.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-xs truncate font-medium">
                        {item.fileName}
                      </TableCell>
                      <TableCell>{fileTypeLabel(item.fileName)}</TableCell>
                      <TableCell>
                        {item.uploadedByName ??
                          userNames[item.uploadedBy] ??
                          item.uploadedBy}
                      </TableCell>
                      <TableCell>
                        {new Date(item.uploadedAt).toLocaleString(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteEvidenceAlert
                          item={item}
                          onDeleted={(id) =>
                            setEvidence((prev) => (prev ?? []).filter((e) => e.id !== id))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <AiClassificationSection
            studyId={studyId}
            hasNeed={hasNeed}
            evidenceCount={sortedEvidence.length}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}

export default function EvidenceUploadPage({
  params,
}: {
  params: Promise<{ studyId: string }>;
}) {
  const { studyId } = use(params);

  return (
    <PermissionGuard module="dataCollection" action="write">
      <EvidenceUploadScreen studyId={studyId} />
    </PermissionGuard>
  );
}
