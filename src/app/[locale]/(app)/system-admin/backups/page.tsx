"use client";

import { Database, HardDrive, Paperclip, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { backupsService } from "@/services/backups/backups.service";
import {
  BACKUP_KINDS,
  BACKUP_STATUSES,
  type BackupKind,
  type BackupRun,
  type BackupSummary,
} from "@/services/backups/backups.types";

const PAGE_SIZE = 25;
const ALL = "__all__";

/**
 * RIO-NFR-010 — Backups.
 *
 * AC 2 is "backup logs auditable", and this screen is where they are audited.
 * The design follows one idea: the question an administrator opens it to answer
 * is not "did a backup run" but "**can I restore**". Those are different
 * questions, and a screen that answers the first while implying the second is
 * worse than no screen — a failed run looks like coverage until someone needs
 * it.
 *
 * So the top of the page is when a backup last SUCCEEDED, per kind, and how
 * many have failed recently. Not a run count.
 */
export default function BackupsPage() {
  const t = useTranslations("systemAdmin.backups");
  const format = useFormatter();
  const canRun = usePermission("backups", "write");

  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, string>>({});

  const load = useCallback(
    (signal?: AbortSignal) =>
      Promise.all([
        backupsService.list(
          {
            page,
            pageSize: PAGE_SIZE,
            ...(kind === ALL ? {} : { kind: kind as BackupKind }),
            ...(status === ALL ? {} : { status }),
          },
          signal,
        ),
        backupsService.summary(signal),
      ]).then(
        ([listed, summarised]) => {
          setRuns(listed.items);
          setTotal(listed.total);
          setSummary(summarised);
          setError(null);
          setLoading(false);
        },
        (cause: unknown) => {
          // An aborted request is a superseded one, not a broken one — and a
          // `finally` here would clear the spinner for a request whose
          // replacement is still in flight.
          if (cause instanceof ApiError && cause.cancelled) return;
          setError(t("loadError"));
          setLoading(false);
        },
      ),
    [page, kind, status, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const onFilter = (setter: (value: string) => void) => (value: string) => {
    setLoading(true);
    setter(value);
    setPage(1);
  };

  const runBackup = (which: BackupKind) => {
    setBusy(`run-${which}`);
    setNotice(null);
    void backupsService
      .run(which)
      .then((result) => {
        setNotice(
          result.success
            ? t("runSucceeded", { kind: t(`kind.${which}`) })
            : t("runFailed", { error: result.error ?? "" }),
        );
        setLoading(true);
        return load();
      })
      .catch(() => setNotice(t("runError")))
      .finally(() => setBusy(null));
  };

  const verify = (run: BackupRun) => {
    setBusy(`verify-${run.id}`);
    void backupsService
      .verify(run.id)
      .then((result) => {
        setVerified((prev) => ({
          ...prev,
          [run.id]: result.ok ? "ok" : (result.reason ?? "unknown"),
        }));
      })
      .catch(() => {
        setVerified((prev) => ({ ...prev, [run.id]: "unknown" }));
      })
      .finally(() => setBusy(null));
  };

  return (
    <PermissionGuard module="backups" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canRun ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => runBackup("database")}
                >
                  <Database className="size-4" />
                  {busy === "run-database" ? t("running") : t("runDatabase")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => runBackup("attachments")}
                >
                  <Paperclip className="size-4" />
                  {busy === "run-attachments" ? t("running") : t("runAttachments")}
                </Button>
              </div>
            ) : null
          }
        />

        {/* The four figures worth a glance. `lastSuccessful`, not `lastRun`:
            a failed run is worse than no run because it looks like coverage. */}
        {summary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Database className="size-4" />}
              label={t("summary.lastDatabase")}
              value={
                summary.lastSuccessfulDatabase
                  ? format.dateTime(new Date(summary.lastSuccessfulDatabase), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : t("summary.never")
              }
              tone={summary.lastSuccessfulDatabase ? "normal" : "bad"}
            />
            <SummaryCard
              icon={<Paperclip className="size-4" />}
              label={t("summary.lastAttachments")}
              value={
                summary.lastSuccessfulAttachments
                  ? format.dateTime(new Date(summary.lastSuccessfulAttachments), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : t("summary.never")
              }
              tone={summary.lastSuccessfulAttachments ? "normal" : "bad"}
            />
            <SummaryCard
              icon={<ShieldCheck className="size-4" />}
              label={t("summary.failures")}
              value={String(summary.failuresLast7Days)}
              tone={summary.failuresLast7Days > 0 ? "bad" : "normal"}
            />
            <SummaryCard
              icon={<HardDrive className="size-4" />}
              label={t("summary.stored")}
              value={formatBytes(summary.totalSizeBytes)}
              tone="normal"
            />
          </div>
        )}

        {/* Stated plainly rather than left for someone to infer from an empty
            table: a schedule is not a restore, and this platform has not
            proven one yet. */}
        {summary && !summary.lastSuccessfulDatabase && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6">
              <p className="text-sm font-medium">{t("noDatabaseBackup.title")}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("noDatabaseBackup.detail")}
              </p>
            </CardContent>
          </Card>
        )}

        {notice && (
          <Card>
            <CardContent className="pt-6">
              <p className="max-w-4xl text-sm break-words" dir="auto">
                {notice}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Select value={kind} onValueChange={onFilter(setKind)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t("filters.kind")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allKinds")}</SelectItem>
              {BACKUP_KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`kind.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={onFilter(setStatus)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
              {BACKUP_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canRun && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                setBusy("prune");
                void backupsService
                  .prune()
                  .then((result) => {
                    setNotice(t("pruned", { count: result.pruned }));
                    setLoading(true);
                    return load();
                  })
                  .catch(() => setNotice(t("runError")))
                  .finally(() => setBusy(null));
              }}
            >
              {busy === "prune" ? t("running") : t("prune")}
            </Button>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : runs.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.started")}</TableHead>
                  <TableHead>{t("table.kind")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead className="text-end">{t("table.size")}</TableHead>
                  <TableHead className="text-end">{t("table.duration")}</TableHead>
                  <TableHead>{t("table.trigger")}</TableHead>
                  <TableHead>{t("table.retention")}</TableHead>
                  <TableHead>{t("table.integrity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="whitespace-nowrap">
                      {format.dateTime(new Date(run.startedAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {run.fileName && (
                        <span
                          className="text-muted-foreground block max-w-72 truncate text-xs"
                          dir="auto"
                        >
                          {run.fileName}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{t(`kind.${run.kind}`)}</TableCell>
                    <TableCell className="align-top">
                      <StatusBadge
                        status={run.status}
                        label={t(`status.${run.status}`)}
                      />
                      {run.error && (
                        // The reason belongs next to the failure, not behind a
                        // click: nobody chases a detail view for a backup they
                        // did not know had failed.
                        //
                        // Width is set on an inner div, not the cell: a table
                        // cell sizes to its content regardless of max-width, so
                        // a long error pushed the table past the viewport and
                        // truncated itself against the edge — unreadable, and
                        // it dragged every other column out of view with it.
                        // Two lines here, the rest on hover.
                        <div className="w-[22rem] max-w-full">
                          <span
                            className="text-destructive mt-1 line-clamp-2 block text-xs break-words"
                            title={run.error}
                            dir="auto"
                          >
                            {run.error}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap tabular-nums">
                      {run.sizeBytes === null ? "—" : formatBytes(run.sizeBytes)}
                      {run.fileCount !== null && (
                        <span className="text-muted-foreground block text-xs">
                          {t("table.files", { count: run.fileCount })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap tabular-nums">
                      {run.durationMs === null ? "—" : formatDuration(run.durationMs)}
                    </TableCell>
                    <TableCell>{t(`trigger.${run.trigger}`)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {run.prunedAt
                        ? t("table.pruned")
                        : run.retainUntil
                          ? format.dateTime(new Date(run.retainUntil), {
                              dateStyle: "medium",
                            })
                          : "—"}
                    </TableCell>
                    <TableCell>
                      {run.status !== "succeeded" || run.prunedAt ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : verified[run.id] ? (
                        <span
                          className={
                            verified[run.id] === "ok"
                              ? "text-xs text-emerald-600 dark:text-emerald-500"
                              : "text-destructive text-xs"
                          }
                        >
                          {verified[run.id] === "ok"
                            ? t("integrity.ok")
                            : t(`integrity.${verified[run.id]}`)}
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => verify(run)}
                        >
                          {busy === `verify-${run.id}` ? t("running") : t("verify")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            onPageChange={(next) => {
              setLoading(true);
              setPage(next);
            }}
            previousLabel={t("pagination.previous")}
            nextLabel={t("pagination.next")}
            pageLabel={(current, count) =>
              t("pagination.label", { page: current, count })
            }
          />
        )}
      </PageContainer>
    </PermissionGuard>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "normal" | "bad";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {icon}
          {label}
        </div>
        <p
          className={`mt-2 text-lg font-semibold tabular-nums ${
            tone === "bad" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  // A pill rather than a red word: a failure has to be findable by scanning
  // the column, not by reading every row.
  const variant =
    status === "succeeded"
      ? "secondary"
      : status === "failed"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

/** Binary units, matching what the filesystem reports. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
