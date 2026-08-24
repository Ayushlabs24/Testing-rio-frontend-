"use client";

import { AlertTriangle } from "lucide-react";
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
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";

interface DeactivateOrganizationDialogProps {
  organization: OrganizationSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function DeactivateOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onUpdated,
}: DeactivateOrganizationDialogProps) {
  const t = useTranslations("systemAdmin.deactivateDialog");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!organization) return null;

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await organizationsService.updateStatus(organization.id, {
        isActive: false,
        reason: reason.trim() || undefined,
      });

      setReason("");
      onOpenChange(false);
      onUpdated();
    } catch {
      setErrorMsg(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="size-5" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription className="text-foreground pt-2 font-medium">
            {organization.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMsg ? (
            <div className="bg-destructive/10 text-destructive rounded p-3 text-xs">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-semibold">• {t("warningNotice")}</p>
            <p>• {t("preservationNotice")}</p>
            <p>• {t("noDeleteNotice")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deactivate-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="deactivate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
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
            type="button"
            variant="destructive"
            onClick={handleDeactivate}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("deactivating") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
