"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/services/api/types";
import { studiesService } from "@/services/studies/studies.service";

interface DeleteStudyDialogProps {
  studyId: string;
  trigger: ReactNode;
  onDeleted: (id: string) => void;
}

export function DeleteStudyDialog({
  studyId,
  trigger,
  onDeleted,
}: DeleteStudyDialogProps) {
  const t = useTranslations("app.studies.delete");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (event: React.MouseEvent) => {
    // Hold the dialog open so a failure is readable — Radix would otherwise
    // close it on action click and swallow the message.
    event.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await studiesService.remove(studyId);
      setOpen(false);
      onDeleted(studyId);
    } catch (err) {
      // 409 STUDY_APPROVED is the expected refusal — an approved study
      // underpins a released report and cannot be deleted.
      setError(
        err instanceof ApiError && err.status === 409
          ? t("approvedBlocked")
          : err instanceof ApiError
            ? err.message
            : t("approvedBlocked"),
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      {trigger}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
