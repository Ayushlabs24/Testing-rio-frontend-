"use client";

import { Plus, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { FormattedDate } from "@/components/common/formatted-date";
import { RejectReasonDialog } from "@/components/features/sharing/reject-reason-dialog";
import type { SharingInnerTab } from "@/components/features/sharing/study-sharing-panel";
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
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { SHARING_PAGE_SIZE, SHARING_ROWS_PER_PAGE_OPTIONS } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { reportSharingService } from "@/services/report-sharing/report-sharing.service";
import type {
  OrgLookupResult,
  ReportLookupResult,
  ReportSharingRequest,
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
  const [noteError, setNoteError] = useState<string | null>(null);
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
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setNoteError(t("purposeRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reportSharingService.create({
        ownerOrgId,
        reportId,
        note: trimmedNote,
      });
      onOpenChange(false);
      setOwnerOrgId(null);
      setReportId(null);
      setNote("");
      setNoteError(null);
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
            <Label htmlFor="report-sharing-note">
              {t("noteLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="report-sharing-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError(null);
              }}
              placeholder={t("notePlaceholder")}
              aria-invalid={noteError ? true : undefined}
            />
            {noteError ? <p className="text-destructive text-sm">{noteError}</p> : null}
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

export function ReportSharingPanel({
  initialTab,
}: { initialTab?: SharingInnerTab } = {}) {
  const t = useTranslations("app.reportSharing");
  const { session } = useAuth();
  const canCreate = usePermission("archiveSharingAudit", "create");
  const canApprove = usePermission("archiveSharingAudit", "approve");

  const [requests, setRequests] = useState<ReportSharingRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SharingInnerTab>(initialTab ?? "incoming");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(SHARING_PAGE_SIZE);

  function handleTabChange(next: string) {
    setActiveTab(next as SharingInnerTab);
    setPage(1);
  }

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

  async function handleReject(id: string, reason: string) {
    setActionError(null);
    try {
      await reportSharingService.reject(id, { note: reason });
      setRejectTargetId(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t("create.genericError"));
    }
  }

  function renderTable(
    rows: ReportSharingRequest[],
    emptyLabel: string,
    options: {
      showRole?: boolean;
      showDecision?: boolean;
      showView?: boolean;
      showPurpose?: boolean;
      showRejectReason?: boolean;
    },
  ) {
    const columnCount =
      5 +
      (options.showRole ? 1 : 0) +
      (options.showPurpose ? 1 : 0) +
      (options.showRejectReason ? 1 : 0);
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return (
      <Card>
        <CardContent className="p-0">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">{t("reportColumn")}</TableHead>
                <TableHead className="w-40">{t("orgColumn")}</TableHead>
                {options.showRole ? (
                  <TableHead className="w-28">{t("roleColumn")}</TableHead>
                ) : null}
                {options.showPurpose ? (
                  <TableHead className="w-56">{t("purposeColumn")}</TableHead>
                ) : null}
                {options.showRejectReason ? (
                  <TableHead className="w-56">{t("rejectReasonColumn")}</TableHead>
                ) : null}
                <TableHead className="w-28">{t("statusColumn")}</TableHead>
                <TableHead className="w-40">{t("requestedColumn")}</TableHead>
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
                pagedRows.map((request) => {
                  const isOwnerView = request.ownerOrgId === myOrgId;
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="py-4 text-sm font-medium break-words whitespace-normal">
                        {request.reportTitle}
                      </TableCell>
                      <TableCell className="py-4 text-sm break-words whitespace-normal">
                        {isOwnerView ? request.requestingOrgName : request.ownerOrgName}
                      </TableCell>
                      {options.showRole ? (
                        <TableCell className="text-sm">
                          {isOwnerView ? t("roleOwner") : t("roleRequester")}
                        </TableCell>
                      ) : null}
                      {options.showPurpose ? (
                        <TableCell className="max-w-64 text-sm break-words whitespace-normal">
                          {request.note ?? "—"}
                        </TableCell>
                      ) : null}
                      {options.showRejectReason ? (
                        <TableCell className="max-w-64 text-sm break-words whitespace-normal">
                          {request.decisionNote ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[request.status]}>
                          {t(`status.${request.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <FormattedDate value={request.requestedAt} withTime />
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
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/sharing/reports/${request.id}`}>
                                {t("view")}
                              </Link>
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

          {rows.length > 0 ? (
            <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-40"
                  aria-label={t("rowsPerPageLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARING_ROWS_PER_PAGE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {t("rowsPerPageLabel")}: {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onPageChange={setPage}
                previousLabel={t("pagination.previous")}
                nextLabel={t("pagination.next")}
                pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                className="sm:w-auto"
              />
            </div>
          ) : null}
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

      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
          {renderTable(incoming, t("noIncoming"), {
            showDecision: true,
            showPurpose: true,
          })}
        </TabsContent>
        <TabsContent value="outgoing" className="mt-6">
          {renderTable(outgoing, t("noOutgoing"), { showPurpose: true })}
        </TabsContent>
        <TabsContent value="approved" className="mt-6">
          {renderTable(approved, t("noApproved"), { showRole: true })}
        </TabsContent>
        <TabsContent value="rejected" className="mt-6">
          {renderTable(rejected, t("noRejected"), {
            showRole: true,
            showRejectReason: true,
          })}
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
      <RejectReasonDialog
        open={rejectTargetId !== null}
        onOpenChange={(open) => !open && setRejectTargetId(null)}
        onConfirm={(reason) => handleReject(rejectTargetId as string, reason)}
        title={t("rejectDialog.title")}
        reasonLabel={t("rejectDialog.reasonLabel")}
        reasonRequiredError={t("rejectDialog.reasonRequired")}
        cancelLabel={t("rejectDialog.cancel")}
        confirmLabel={t("rejectDialog.confirm")}
      />
    </div>
  );
}
