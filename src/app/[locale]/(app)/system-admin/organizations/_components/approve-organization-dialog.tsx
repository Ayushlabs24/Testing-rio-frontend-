"use client";

import { ShieldCheck } from "lucide-react";
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
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";

interface ApproveOrganizationDialogProps {
  organization: OrganizationSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

/**
 * RIO-FR-010 (client-confirmed): self-registered entities require Center
 * (System Admin) approval before activation. Separate from
 * ReactivateOrganizationDialog — that one just flips an already-approved,
 * already-credentialed org back to active; this one is the first-ever
 * activation, which also issues the entity's real temporary password
 * (emailed to its admin — see OrganizationsService.approve on the backend).
 */
export function ApproveOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onUpdated,
}: ApproveOrganizationDialogProps) {
  const t = useTranslations("systemAdmin.approveDialog");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!organization) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await organizationsService.approve(organization.id);
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
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
            <ShieldCheck className="size-5" />
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

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            {t("explanation")}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            onClick={handleApprove}
            disabled={isSubmitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            {isSubmitting ? t("approving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
