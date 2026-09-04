"use client";

import { Plus, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { FormattedDate } from "@/components/common/formatted-date";
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
import { RejectReasonDialog } from "@/components/features/sharing/reject-reason-dialog";
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
import { ApiError } from "@/services/api/types";
import { sharingService } from "@/services/sharing/sharing.service";
import type {
  OrgLookupResult,
  SharedStudySnapshot,
  SharingRequest,
  SharingStatus,
  StudyLookupResult,
} from "@/services/sharing/sharing.types";

const STATUS_VARIANT: Record<
  SharingStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  expired: "outline",
  withdrawn: "outline",
};

function CreateRequestDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("app.sharing.create");
  const [orgOptions, setOrgOptions] = useState<OrgLookupResult[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [ownerOrgId, setOwnerOrgId] = useState<string | null>(null);

  const [studyOptions, setStudyOptions] = useState<StudyLookupResult[]>([]);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyId, setStudyId] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function loadOrgs() {
      setOrgLoading(true);
      try {
        setOrgOptions(await sharingService.lookupOrganizations(""));
      } finally {
        setOrgLoading(false);
      }
    }
    loadOrgs();
  }, [open]);

  useEffect(() => {
    async function loadStudies() {
      if (!ownerOrgId) {
        setStudyOptions([]);
        return;
      }
      setStudyLoading(true);
      setStudyId(null);
      try {
        setStudyOptions(await sharingService.lookupStudiesForOrg(ownerOrgId));
      } finally {
        setStudyLoading(false);
      }
    }
    loadStudies();
  }, [ownerOrgId]);

  async function handleOrgQueryChange(query: string) {
    setOrgLoading(true);
    try {
      setOrgOptions(await sharingService.lookupOrganizations(query));
    } finally {
      setOrgLoading(false);
    }
  }

  async function submit() {
    if (!ownerOrgId || !studyId) return;
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setNoteError(t("purposeRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sharingService.create({ ownerOrgId, studyId, note: trimmedNote });
      onOpenChange(false);
      setOwnerOrgId(null);
      setStudyId(null);
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
            <Label>{t("studyLabel")}</Label>
            <Combobox
              items={studyOptions.map((s) => ({ value: s.id, label: s.title }))}
              value={studyId}
              onSelect={setStudyId}
              loading={studyLoading}
              disabled={!ownerOrgId}
              placeholder={t("studyPlaceholder")}
              searchPlaceholder={t("studySearchPlaceholder")}
              emptyText={ownerOrgId ? t("studyEmpty") : t("studySelectOrgFirst")}
              aria-label={t("studyLabel")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sharing-note">
              {t("noteLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="sharing-note"
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
          <Button onClick={submit} disabled={submitting || !ownerOrgId || !studyId}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SharedStudyDialog({
  snapshot,
  onOpenChange,
}: {
  snapshot: SharedStudySnapshot | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("app.sharing.sharedStudy");
  return (
    <Dialog open={snapshot !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{snapshot?.title ?? t("title")}</DialogTitle>
        </DialogHeader>
        {snapshot ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">{t("statusLabel")}</p>
              <p>{snapshot.status}</p>
            </div>
            {snapshot.needStatement ? (
              <div>
                <p className="text-muted-foreground text-xs">{t("needStatementLabel")}</p>
                <p>{snapshot.needStatement}</p>
              </div>
            ) : null}
            <div>
              <p className="text-muted-foreground text-xs">{t("villagesLabel")}</p>
              <p>{snapshot.needVillages.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{t("evidenceCountLabel")}</p>
              <p>{snapshot.evidenceCount}</p>
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

export type SharingInnerTab =
  | "incoming"
  | "outgoing"
  | "approved"
  | "rejected"
  | "sharedReports"
  | "allOrganizations";

export function StudySharingPanel({ initialTab }: { initialTab?: SharingInnerTab } = {}) {
  const t = useTranslations("app.sharing");
  const { session } = useAuth();
  const canCreate = usePermission("archiveSharingAudit", "create");
  const canApprove = usePermission("archiveSharingAudit", "approve");

  const [requests, setRequests] = useState<SharingRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SharedStudySnapshot | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});

  function load() {
    sharingService
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
      const expiresAtDraft = expiryDrafts[id];
      await sharingService.approve(id, {
        expiresAt: expiresAtDraft ? new Date(expiresAtDraft).toISOString() : undefined,
      });
      setExpiryDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      load();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.code ? err.message : t("create.genericError"),
      );
    }
  }

  async function handleWithdraw(id: string) {
    setActionError(null);
    try {
      await sharingService.withdraw(id);
      load();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.code ? err.message : t("create.genericError"),
      );
    }
  }

  async function handleReject(id: string, reason: string) {
    setActionError(null);
    try {
      await sharingService.reject(id, { note: reason });
      setRejectTargetId(null);
      load();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.code ? err.message : t("create.genericError"),
      );
    }
  }

  async function handleViewShared(id: string) {
    setActionError(null);
    try {
      const result = await sharingService.getSharedStudy(id);
      setSnapshot(result);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : t("sharedStudy.genericError"),
      );
    }
  }

  function renderTable(
    rows: SharingRequest[],
    emptyLabel: string,
    options: {
      showRole?: boolean;
      showDecision?: boolean;
      showView?: boolean;
      showPurpose?: boolean;
      showRejectReason?: boolean;
      showWithdraw?: boolean;
      showExpiry?: boolean;
    },
  ) {
    const columnCount =
      5 +
      (options.showRole ? 1 : 0) +
      (options.showPurpose ? 1 : 0) +
      (options.showRejectReason ? 1 : 0) +
      (options.showExpiry ? 1 : 0);
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studyColumn")}</TableHead>
                  <TableHead>{t("orgColumn")}</TableHead>
                  {options.showRole ? (
                    <TableHead className="w-28">{t("roleColumn")}</TableHead>
                  ) : null}
                  {options.showPurpose ? (
                    <TableHead className="w-64">{t("purposeColumn")}</TableHead>
                  ) : null}
                  {options.showRejectReason ? (
                    <TableHead className="w-64">{t("rejectReasonColumn")}</TableHead>
                  ) : null}
                  {options.showExpiry ? (
                    <TableHead className="w-44">{t("expiryColumn")}</TableHead>
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
                          {request.studyTitle}
                        </TableCell>
                        <TableCell className="py-4 text-sm">
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
                        {options.showExpiry ? (
                          <TableCell className="text-muted-foreground text-sm break-words whitespace-normal">
                            {request.status === "withdrawn" && request.withdrawnAt ? (
                              <FormattedDate value={request.withdrawnAt} withTime />
                            ) : request.expiresAt ? (
                              <FormattedDate value={request.expiresAt} />
                            ) : (
                              t("noExpiry")
                            )}
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
                          <div className="flex flex-col items-end gap-1.5">
                            {options.showDecision && isOwnerView && canApprove ? (
                              <input
                                type="date"
                                aria-label={t("expiryInputLabel")}
                                title={t("expiryInputLabel")}
                                className="border-input h-8 w-full max-w-40 rounded-md border bg-transparent px-2 text-sm"
                                value={expiryDrafts[request.id] ?? ""}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={(e) =>
                                  setExpiryDrafts((prev) => ({
                                    ...prev,
                                    [request.id]: e.target.value,
                                  }))
                                }
                              />
                            ) : null}
                            <div className="flex flex-wrap justify-end gap-2">
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
                              {options.showWithdraw &&
                              isOwnerView &&
                              canApprove &&
                              request.status === "approved" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => handleWithdraw(request.id)}
                                >
                                  {t("withdraw")}
                                </Button>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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

      <Tabs defaultValue={initialTab ?? "incoming"}>
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
          {renderTable(approved, t("noApproved"), {
            showRole: true,
            showWithdraw: true,
            showExpiry: true,
          })}
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

      <CreateRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
      <SharedStudyDialog
        snapshot={snapshot}
        onOpenChange={(open) => !open && setSnapshot(null)}
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
