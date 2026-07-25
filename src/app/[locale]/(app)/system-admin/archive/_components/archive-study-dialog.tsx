"use client";

import { Archive, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/services/api/client";

interface ArchiveStudyDialogProps {
  studyId: string | null;
  studyTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
}

export function ArchiveStudyDialog({
  studyId,
  studyTitle,
  open,
  onOpenChange,
  onArchived,
}: ArchiveStudyDialogProps) {
  const t = useTranslations("systemAdmin.archive.archiveDialog");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleArchive = async () => {
    if (!studyId) return;
    try {
      setSubmitting(true);
      setErrorMessage(null);
      await apiClient.post(`/studies/${studyId}/archive`, { reason });
      onArchived();
      onOpenChange(false);
    } catch (err) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string } } };
        message?: string;
      };
      setErrorMessage(
        errorObj?.response?.data?.error?.message ?? errorObj?.message ?? t("errorToast"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Archive className="size-5" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-xs">
            {t("explanation")}
          </DialogDescription>
        </DialogHeader>

        {studyTitle ? (
          <div className="border-border bg-muted/30 rounded border p-3 text-xs">
            <span className="text-foreground font-semibold">{studyTitle}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded p-3 text-xs">
            <AlertTriangle className="size-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-xs">{t("reasonLabel")}</Label>
          <Input
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="text-xs"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleArchive}
            disabled={submitting}
            className="gap-1 bg-amber-600 text-white hover:bg-amber-700"
          >
            {submitting ? t("archiving") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
