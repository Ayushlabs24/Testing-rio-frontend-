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
  /** Defaults to "destructive" — every existing Sharing/Report-sharing
   * reject call site is unaffected. Pass "default" to reuse this same
   * dialog for a non-destructive mandatory-notes action (e.g. the NCNP
   * Report Review's Approve step) instead of writing a near-duplicate
   * dialog component for that one difference. */
  confirmVariant?: "destructive" | "default";
}

/** Shared by Study-sharing/Report-sharing's reject action and the NCNP
 * Report Review's approve/reject actions — anywhere a single mandatory
 * free-text reason gates a decision (both client-side here and
 * re-enforced server-side). */
export function RejectReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  reasonLabel,
  reasonRequiredError,
  cancelLabel,
  confirmLabel,
  confirmVariant = "destructive",
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
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={submitting}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
