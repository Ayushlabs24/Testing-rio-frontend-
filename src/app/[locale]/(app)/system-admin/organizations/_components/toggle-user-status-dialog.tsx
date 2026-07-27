"use client";

import { AlertTriangle, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";

interface ToggleUserStatusDialogProps {
  organizationId: string;
  isOrgActive: boolean;
  user: OrgUser | null;
  targetStatus: "active" | "disabled";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function ToggleUserStatusDialog({
  organizationId,
  isOrgActive,
  user,
  targetStatus,
  open,
  onOpenChange,
  onUpdated,
}: ToggleUserStatusDialogProps) {
  const isDisabling = targetStatus === "disabled";
  const tDisable = useTranslations("systemAdmin.users.disableDialog");
  const tEnable = useTranslations("systemAdmin.users.enableDialog");

  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isDisabling && !isOrgActive) {
      setErrorMsg(tEnable("inactiveOrgError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await usersService.updateStatusForOrg(organizationId, user.id, {
        status: targetStatus,
        reason: reason.trim() || undefined,
      });

      setReason("");
      onOpenChange(false);
      onUpdated();
    } catch (err: unknown) {
      const fallback = isDisabling ? tDisable("errorToast") : tEnable("errorToast");
      const errorObj = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      const msg =
        errorObj?.response?.data?.error?.message || errorObj?.message || fallback;
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
            <div
              className={`flex items-center gap-2 ${isDisabling ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              {isDisabling ? (
                <UserX className="size-5" />
              ) : (
                <UserCheck className="size-5" />
              )}
              <DialogTitle>
                {isDisabling ? tDisable("title") : tEnable("title")}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-xs">
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

            {!isDisabling && !isOrgActive ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>{tEnable("inactiveOrgError")}</p>
              </div>
            ) : null}

            <p className="text-muted-foreground text-xs leading-relaxed">
              {isDisabling ? tDisable("explanation") : tEnable("explanation")}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="status-reason">{tDisable("reasonLabel")}</Label>
              <Textarea
                id="status-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tDisable("reasonPlaceholder")}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {isDisabling ? tDisable("cancel") : tEnable("cancel")}
            </Button>
            <Button
              type="submit"
              variant={isDisabling ? "destructive" : "default"}
              disabled={isSubmitting || (!isDisabling && !isOrgActive)}
              className={
                !isDisabling
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600"
                  : undefined
              }
            >
              {isSubmitting
                ? isDisabling
                  ? tDisable("disabling")
                  : tEnable("enabling")
                : isDisabling
                  ? tDisable("confirm")
                  : tEnable("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
