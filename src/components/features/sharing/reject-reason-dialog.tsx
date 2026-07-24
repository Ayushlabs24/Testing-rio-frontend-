"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;
  reasonLabel: string;
  reasonRequiredError: string;
  cancelLabel: string;
  confirmLabel: string;
}

/** Shared by both Study-sharing and Report-sharing's reject action — the
 * requesting org otherwise has no idea what to change before asking again,
 * so a reason is mandatory here (both client-side and re-enforced by
 * SharingService/ReportSharingService.decide() on the backend). */
export function RejectReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  reasonLabel,
  reasonRequiredError,
  cancelLabel,
  confirmLabel,
}: RejectReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(reasonRequiredError);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
      setReason("");
      setError(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">
            {reasonLabel} <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
