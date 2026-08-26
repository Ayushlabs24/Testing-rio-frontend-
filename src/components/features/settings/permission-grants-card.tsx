"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSION_GRANTS_PAGE_SIZE } from "@/config/pagination";
import { ApiError } from "@/services/api/types";
import { permissionGrantsService } from "@/services/permission-grants/permission-grants.service";
import type { PermissionGrant } from "@/services/permission-grants/permission-grants.types";
import { usersService } from "@/services/users/users.service";
import type { PlatformUser } from "@/services/users/users.types";
import { PERMISSION_MODULES } from "@/types/permissions";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

const ACTIONS: PermissionAction[] = [
  "read",
  "write",
  "create",
  "approve",
  "export",
  "share",
];

// RIO-RBAC-002 (client-confirmed 2026-08-23, reconfirmed 2026-08-24) — the
// System Admin UI for the runtime permission-grant mechanism. Every grant
// here is checked by PermissionGuard as a fallback ONLY for
// center_supervisor requests the static role matrix already denied — see
// permission.guard.ts. Deliberately no per-entity scope anywhere in this
// screen: a grant always applies across every entity.
export function PermissionGrantsCard({ canWrite }: { canWrite: boolean }) {
  const t = useTranslations("app.settings.roles.grants");
  const [grants, setGrants] = useState<PermissionGrant[] | null>(null);
  const [supervisors, setSupervisors] = useState<PlatformUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [granteeId, setGranteeId] = useState("");
  const [module, setModule] = useState<PermissionModule | "">("");
  const [action, setAction] = useState<PermissionAction | "">("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Grows by one row every time a grant is issued, with no upper bound —
  // needs real pagination, unlike the small option lists elsewhere on this
  // page (Study Types, Target Sectors).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PERMISSION_GRANTS_PAGE_SIZE);

  function load() {
    permissionGrantsService
      .list()
      .then(setGrants)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("loadError")));
  }

  useEffect(() => {
    load();
    usersService
      .listAll()
      .then((all) =>
        setSupervisors(all.filter((u) => u.role.key === "center_supervisor")),
      )
      .catch(() => setSupervisors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setGranteeId("");
    setModule("");
    setAction("");
    setReason("");
    setExpiresAt("");
    setFormError(null);
  }

  async function handleCreate() {
    if (!granteeId || !module || !action || !reason.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await permissionGrantsService.create({
        granteeId,
        module,
        action,
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setAddOpen(false);
      resetForm();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await permissionGrantsService.revoke(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setRevokingId(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil((grants?.length ?? 0) / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedGrants = (grants ?? []).slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-foreground text-sm font-semibold">{t("heading")}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{t("note")}</p>
        </div>
        {canWrite ? (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              resetForm();
              setAddOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("newGrant")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-0">
        {error ? <p className="text-destructive px-5 pb-3 text-sm">{error}</p> : null}
        {grants === null ? (
          <div className="bg-muted mx-5 mb-5 h-20 animate-pulse rounded-md" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("granteeLabel")}</TableHead>
                <TableHead>{t("permissionLabel")}</TableHead>
                <TableHead>{t("reasonLabel")}</TableHead>
                <TableHead>{t("statusLabel")}</TableHead>
                {canWrite ? (
                  <TableHead className="text-end">{t("actionsLabel")}</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {grants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canWrite ? 5 : 4}
                    className="text-muted-foreground text-center"
                  >
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : (
                pagedGrants.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell className="text-foreground font-medium">
                      {grant.granteeName ?? grant.granteeId}
                    </TableCell>
                    <TableCell className="text-sm">
                      {grant.module}:{grant.action}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground max-w-xs truncate text-sm"
                      title={grant.reason}
                    >
                      {grant.reason}
                    </TableCell>
                    <TableCell>
                      {grant.revokedAt ? (
                        <Badge variant="outline">{t("statusRevoked")}</Badge>
                      ) : !grant.isActive ? (
                        <Badge variant="outline">{t("statusExpired")}</Badge>
                      ) : (
                        <Badge className="bg-badge-success text-badge-success-foreground border-transparent">
                          {t("statusActive")}
                        </Badge>
                      )}
                    </TableCell>
                    {canWrite ? (
                      <TableCell className="text-end">
                        {grant.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevoke(grant.id)}
                            disabled={revokingId === grant.id}
                          >
                            {t("revoke")}
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        {grants && grants.length > 0 ? (
          <div className="border-border flex flex-col gap-3 border-t px-5 pt-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-full sm:w-40" aria-label={t("rowsPerPage")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {t("rowsPerPage")}: {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              previousLabel={t("pagePrevious")}
              nextLabel={t("pageNext")}
              pageLabel={(p, count) => t("pageLabel", { page: p, count })}
              className="sm:w-auto"
            />
          </div>
        ) : null}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newGrant")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("granteeLabel")}</Label>
              <Select value={granteeId} onValueChange={setGranteeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("granteePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {supervisors.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} — {u.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supervisors.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t("noSupervisors")}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("moduleLabel")}</Label>
                <Select
                  value={module}
                  onValueChange={(v) => setModule(v as PermissionModule)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("modulePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_MODULES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("actionLabel")}</Label>
                <Select
                  value={action}
                  onValueChange={(v) => setAction(v as PermissionAction)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("actionPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-reason">{t("reasonLabel")}</Label>
              <Textarea
                id="grant-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-expiry">{t("expiryLabel")}</Label>
              <Input
                id="grant-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">{t("expiryNote")}</p>
            </div>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={saving || !granteeId || !module || !action || !reason.trim()}
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
