"use client";

import { Shield, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { getAssignableOrganizationRoles } from "./role-options";

interface RoleOption {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  crossEntity: boolean;
}

interface ChangeRoleDialogProps {
  organizationId: string;
  user: OrgUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function ChangeRoleDialog({
  organizationId,
  user,
  open,
  onOpenChange,
  onUpdated,
}: ChangeRoleDialogProps) {
  const t = useTranslations("systemAdmin.users.changeRoleDialog");

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (open && user) {
      apiClient
        .get<RoleOption[]>(endpoints.roles.list)
        .then((allRoles) => {
          if (isMounted) {
            setSelectedRoleId(user.role.id);
            setReason("");
            setErrorMsg("");
            setRoles(getAssignableOrganizationRoles(allRoles));
          }
        })
        .catch(() => {
          if (isMounted) setRoles([]);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [open, user]);

  if (!user) return null;

  const selectedRoleObj = roles.find((r) => r.id === selectedRoleId);
  const isTargetingNgoAdmin = selectedRoleObj?.key === "ngo_admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoleId || selectedRoleId === user.role.id) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      await usersService.updateRoleForOrg(organizationId, user.id, {
        roleId: selectedRoleId,
        reason: reason.trim() || undefined,
      });

      onOpenChange(false);
      onUpdated();
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      const msg =
        errorObj?.response?.data?.error?.message || errorObj?.message || t("errorToast");
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="text-primary flex items-center gap-2">
              <Shield className="size-5" />
              <DialogTitle>{t("title")}</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-xs">
              {t("description")} —{" "}
              <span className="text-foreground font-semibold">{user.name}</span> (
              {user.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {errorMsg ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-xs">
                {errorMsg}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="change-role-select">
                {t("selectRoleLabel")} <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger id="change-role-select">
                  <SelectValue placeholder={t("selectRolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isTargetingNgoAdmin && user.role.key !== "ngo_admin" ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>{t("ngoAdminWarning")}</p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="change-role-reason">{t("reasonLabel")}</Label>
              <Textarea
                id="change-role-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || !selectedRoleId || selectedRoleId === user.role.id
              }
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
