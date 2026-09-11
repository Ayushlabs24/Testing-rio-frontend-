"use client";

import { useState } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RejectReasonDialog } from "@/components/features/sharing/reject-reason-dialog";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { resolveApiErrorMessage } from "@/lib/api-error-message";
import {
  ncnpReportReviewService,
  type NcnpReportReviewSummary,
} from "@/services/ncnp-report-review/ncnp-report-review.service";

// Generate is NOT part of this component — it creates a brand new review
// row rather than acting on an existing one, so it lives once at the list
// page's header (see `page.tsx`), never per-row or per-detail-page. This
// component only ever acts on a specific, already-existing `review`.

// Same icon-button + tooltip shape as report-actions.tsx (the existing
// Reports feature's action bar) — copied rather than imported, since that
// component is typed specifically to the unrelated `Report`/reportsService.
function IconAction({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "outline" | "ghost";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon-sm"
          variant={variant}
          className={className}
          aria-label={label}
          onClick={onClick}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function NcnpReportReviewActions({
  review,
  onChanged,
  onError,
}: {
  review: NcnpReportReviewSummary | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const t = useTranslations("systemAdmin.ncnpReport.review");
  const tApiErr = useTranslations("apiErrors");
  const canPublish = usePermission("ncnpReport", "write");
  const canReview = usePermission("ncnpReport", "approve");
  const [dialogMode, setDialogMode] = useState<"approve" | "reject" | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    onError("");
    try {
      await action();
      onChanged();
      return true;
    } catch (err) {
      onError(resolveApiErrorMessage(err, tApiErr, t("actionError")));
      return false;
    }
  }

  async function handleDialogConfirm(notes: string) {
    if (!review) return;
    const succeeded =
      dialogMode === "approve"
        ? await run(() => ncnpReportReviewService.approve(review.id, notes))
        : dialogMode === "reject"
          ? await run(() => ncnpReportReviewService.reject(review.id, notes))
          : false;
    // RejectReasonDialog doesn't close itself on a successful confirm (it
    // only clears its own reason/error state) — the caller owns dialogMode,
    // so closing it here is this component's job, not left implicit.
    if (succeeded) setDialogMode(null);
  }

  const isDraft = review?.status === "draft";
  const isApproved = review?.status === "approved";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-2">
        {canReview && isDraft ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive gap-1.5"
              onClick={() => setDialogMode("reject")}
            >
              <XCircle className="size-4" />
              {t("reject")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setDialogMode("approve")}
            >
              <CheckCircle2 className="size-4" />
              {t("approve")}
            </Button>
          </>
        ) : null}

        {canPublish && isApproved ? (
          <IconAction
            icon={Send}
            label={t("publish")}
            onClick={() => run(() => ncnpReportReviewService.publish(review!.id))}
          />
        ) : null}
      </div>

      <RejectReasonDialog
        open={dialogMode !== null}
        onOpenChange={(open) => !open && setDialogMode(null)}
        onConfirm={handleDialogConfirm}
        title={
          dialogMode === "approve" ? t("approveDialogTitle") : t("rejectDialogTitle")
        }
        reasonLabel={t("reviewerNotesLabel")}
        reasonRequiredError={t("reviewerNotesRequired")}
        cancelLabel={t("cancel")}
        confirmLabel={dialogMode === "approve" ? t("confirmApprove") : t("confirmReject")}
        confirmVariant={dialogMode === "approve" ? "default" : "destructive"}
      />
    </TooltipProvider>
  );
}
