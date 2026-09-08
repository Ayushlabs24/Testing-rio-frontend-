"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
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

interface ReactivateOrganizationDialogProps {
  organization: OrganizationSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function ReactivateOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onUpdated,
}: ReactivateOrganizationDialogProps) {
  const t = useTranslations("systemAdmin.reactivateDialog");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!organization) return null;

  const handleReactivate = async () => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await organizationsService.updateStatus(organization.id, {
        isActive: true,
      });

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
            <CheckCircle2 className="size-5" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription className="text-foreground pt-2 font-medium">
            <AutoTranslate text={organization.name} />
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
            onClick={handleReactivate}
            disabled={isSubmitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            {isSubmitting ? t("reactivating") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
