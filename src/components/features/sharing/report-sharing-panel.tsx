"use client";

import { Download, Plus, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { RejectReasonDialog } from "@/components/features/sharing/reject-reason-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { usePermission } from "@/hooks/use-permission";
import { flattenReportContent } from "@/lib/report-content-flatten";
import { ApiError } from "@/services/api/types";
import { reportSharingService } from "@/services/report-sharing/report-sharing.service";
import type {
  OrgLookupResult,
  ReportLookupResult,
  ReportSharingRequest,
  SharedReportSnapshot,
  SharingStatus,
} from "@/services/report-sharing/report-sharing.types";

const STATUS_VARIANT: Record<
  SharingStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  expired: "outline",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function CreateReportSharingRequestDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("app.reportSharing.create");
  const [orgOptions, setOrgOptions] = useState<OrgLookupResult[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [ownerOrgId, setOwnerOrgId] = useState<string | null>(null);

  const [reportOptions, setReportOptions] = useState<ReportLookupResult[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function loadOrgs() {
      setOrgLoading(true);
      try {
        setOrgOptions(await reportSharingService.lookupOrganizations(""));
      } finally {
        setOrgLoading(false);
      }
    }
    loadOrgs();
  }, [open]);

  useEffect(() => {
    async function loadReports() {
      if (!ownerOrgId) {
        setReportOptions([]);
        return;
      }
      setReportLoading(true);
      setReportId(null);
      try {
        setReportOptions(await reportSharingService.lookupReportsForOrg(ownerOrgId));
      } finally {
        setReportLoading(false);
      }
    }
    loadReports();
  }, [ownerOrgId]);

  async function handleOrgQueryChange(query: string) {
    setOrgLoading(true);
    try {
      setOrgOptions(await reportSharingService.lookupOrganizations(query));
    } finally {
      setOrgLoading(false);
    }
  }

  async function submit() {
    if (!ownerOrgId || !reportId) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportSharingService.create({
        ownerOrgId,
        reportId,
        note: note || undefined,
      });
      onOpenChange(false);
      setOwnerOrgId(null);
      setReportId(null);
      setNote("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label>{t("ownerOrgLabel")}</Label>
            <Combobox
              items={orgOptions.map((o) => ({ value: o.id, label: o.name }))}
              value={ownerOrgId}
              onSelect={setOwnerOrgId}
              onQueryChange={handleOrgQueryChange}
              loading={orgLoading}
              placeholder={t("ownerOrgPlaceholder")}
              searchPlaceholder={t("ownerOrgSearchPlaceholder")}
              emptyText={t("ownerOrgEmpty")}
              aria-label={t("ownerOrgLabel")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("reportLabel")}</Label>
            <Combobox
              items={reportOptions.map((r) => ({ value: r.id, label: r.title }))}
              value={reportId}
              onSelect={setReportId}
              loading={reportLoading}
              disabled={!ownerOrgId}
              placeholder={t("reportPlaceholder")}
              searchPlaceholder={t("reportSearchPlaceholder")}
              emptyText={ownerOrgId ? t("reportEmpty") : t("reportSelectOrgFirst")}
              aria-label={t("reportLabel")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-sharing-note">{t("noteLabel")}</Label>
            <Textarea
              id="report-sharing-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting || !ownerOrgId || !reportId}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SharedReportDialog({
  requestId,
  snapshot,
  onOpenChange,
}: {
  requestId: string | null;
  snapshot: SharedReportSnapshot | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("app.reportSharing.sharedReport");
  const tParent = useTranslations("app.reportSharing");
  const flattened = snapshot ? flattenReportContent(snapshot.content) : null;
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  async function handleDownload(format: "pdf" | "excel") {
    if (!requestId) return;
    setDownloading(format);
    try {
      await reportSharingService.download(requestId, format);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Dialog open={snapshot !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{snapshot?.title ?? t("title")}</DialogTitle>
        </DialogHeader>
        {snapshot ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">{t("generatedAtLabel")}</p>
              <p>{formatDate(snapshot.generatedAt)}</p>
            </div>
            {flattened?.narrative ? (
              <p className="whitespace-pre-wrap">{flattened.narrative}</p>
            ) : null}
            {flattened && flattened.summaryRows.length > 0 ? (
              <div className="divide-border divide-y">
                {flattened.summaryRows.map((row) => (
                  <div key={row.field} className="flex justify-between gap-4 py-1.5">
                    <span className="text-muted-foreground">{row.field}</span>
                    <span className="text-right">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {!flattened?.narrative && (flattened?.summaryRows.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">{t("noContent")}</p>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={downloading !== null}
                onClick={() => handleDownload("pdf")}
              >
                <Download className="size-3.5" />
                {tParent("exportPdf")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={downloading !== null}
                onClick={() => handleDownload("excel")}
              >
                <Download className="size-3.5" />
                {tParent("exportExcel")}
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportSharingPanel() {
  const t = useTranslations("app.reportSharing");
  const { session } = useAuth();
  const canCreate = usePermission("archiveSharingAudit", "create");
  const canApprove = usePermission("archiveSharingAudit", "approve");

  const [requests, setRequests] = useState<ReportSharingRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [snapshotRequestId, setSnapshotRequestId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SharedReportSnapshot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  function load() {
    reportSharingService
      .list()
      .then((rows) => {
        setRequests(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setRequests([]);
        setLoadFailed(true);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const myOrgId = session?.organization.id;
  const all = requests ?? [];
  const incoming = all.filter((r) => r.ownerOrgId === myOrgId && r.status === "pending");
  const outgoing = all.filter(
    (r) => r.requestingOrgId === myOrgId && r.status === "pending",
  );
  const approved = all.filter((r) => r.status === "approved");
  const rejected = all.filter((r) => r.status === "rejected");
  const sharedReports = all.filter(
    (r) => r.status === "approved" && r.requestingOrgId === myOrgId,
  );

  async function handleApprove(id: string) {
    setActionError(null);
    try {
      await reportSharingService.approve(id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("create.genericError"));
    }
  }

  async function handleReject(id: string, reason: string | undefined) {
    setActionError(null);
    try {
      await reportSharingService.reject(id, { note: reason });
      setRejectTargetId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("create.genericError"));
    }
  }

  async function handleViewShared(id: string) {
    setActionError(null);
    try {
      const result = await reportSharingService.getSharedReport(id);
      setSnapshotRequestId(id);
      setSnapshot(result);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : t("sharedReport.genericError"),
      );
    }
  }

  function renderTable(
    rows: ReportSharingRequest[],
    emptyLabel: string,
    options: { showRole?: boolean; showDecision?: boolean; showView?: boolean },
  ) {
    const columnCount = 5 + (options.showRole ? 1 : 0);
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reportColumn")}</TableHead>
                <TableHead>{t("orgColumn")}</TableHead>
                {options.showRole ? (
                  <TableHead className="w-28">{t("roleColumn")}</TableHead>
                ) : null}
                <TableHead className="w-28">{t("statusColumn")}</TableHead>
                <TableHead className="w-44">{t("requestedColumn")}</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests === null ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: columnCount }).map((__, cell) => (
                      <TableCell key={cell} className="py-4">
                        <div className="bg-muted h-4 w-24 rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="text-muted-foreground h-32 text-center"
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                        <Share2 className="size-5" />
                      </div>
                      <p>{loadFailed ? t("loadError") : emptyLabel}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((request) => {
                  const isOwnerView = request.ownerOrgId === myOrgId;
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="py-4 text-sm font-medium">
                        {request.reportTitle}
                      </TableCell>
                      <TableCell className="py-4 text-sm">
                        {isOwnerView ? request.requestingOrgName : request.ownerOrgName}
                      </TableCell>
                      {options.showRole ? (
                        <TableCell className="text-sm">
                          {isOwnerView ? t("roleOwner") : t("roleRequester")}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[request.status]}>
                          {t(`status.${request.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(request.requestedAt)}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex justify-end gap-2">
                          {options.showDecision && isOwnerView && canApprove ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(request.id)}
                              >
                                {t("approve")}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setRejectTargetId(request.id)}
                              >
                                {t("reject")}
                              </Button>
                            </>
                          ) : null}
                          {options.showView ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewShared(request.id)}
                            >
                              {t("view")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            {t("newRequest")}
          </Button>
        ) : null}
      </div>

      {actionError ? <p className="text-destructive text-sm">{actionError}</p> : null}

      <Tabs defaultValue="incoming">
        <div className="overflow-x-auto">
          <TabsList variant="line" size="lg">
            <TabsTrigger value="incoming" size="lg">
              {t("tabIncoming")}
            </TabsTrigger>
            <TabsTrigger value="outgoing" size="lg">
              {t("tabOutgoing")}
            </TabsTrigger>
            <TabsTrigger value="approved" size="lg">
              {t("tabApproved")}
            </TabsTrigger>
            <TabsTrigger value="rejected" size="lg">
              {t("tabRejected")}
            </TabsTrigger>
            <TabsTrigger value="sharedReports" size="lg">
              {t("tabSharedReports")}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="incoming" className="mt-6">
          {renderTable(incoming, t("noIncoming"), { showDecision: true })}
        </TabsContent>
        <TabsContent value="outgoing" className="mt-6">
          {renderTable(outgoing, t("noOutgoing"), {})}
        </TabsContent>
        <TabsContent value="approved" className="mt-6">
          {renderTable(approved, t("noApproved"), { showRole: true })}
        </TabsContent>
        <TabsContent value="rejected" className="mt-6">
          {renderTable(rejected, t("noRejected"), { showRole: true })}
        </TabsContent>
        <TabsContent value="sharedReports" className="mt-6">
          {renderTable(sharedReports, t("noSharedReports"), { showView: true })}
        </TabsContent>
      </Tabs>

      <CreateReportSharingRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
      <SharedReportDialog
        requestId={snapshotRequestId}
        snapshot={snapshot}
        onOpenChange={(open) => {
          if (!open) {
            setSnapshot(null);
            setSnapshotRequestId(null);
          }
        }}
      />
      <RejectReasonDialog
        open={rejectTargetId !== null}
        onOpenChange={(open) => !open && setRejectTargetId(null)}
        onConfirm={(reason) => handleReject(rejectTargetId as string, reason)}
        title={t("rejectDialog.title")}
        reasonLabel={t("rejectDialog.reasonLabel")}
        cancelLabel={t("rejectDialog.cancel")}
        confirmLabel={t("rejectDialog.confirm")}
      />
    </div>
  );
}
