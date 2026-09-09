"use client";

import {
  Archive,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
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
import { reportsService } from "@/services/reports/reports.service";
import { EXPORTABLE_STATUSES, type Report } from "@/services/reports/reports.types";

type ButtonVariant = "outline" | "ghost";

// A single icon-only action with a descriptive tooltip. The tooltip carries the
// label (previously the button text) so the row stays compact but every symbol
// is still self-explanatory and accessible (aria-label mirrors it).
function IconAction({
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  className,
  iconSize,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  className?: string;
  iconSize: "icon" | "icon-sm";
}): ReactNode {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size={iconSize}
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

// Lifecycle + export actions for a single report, shared by the list rows and
// the detail header so the two-step approval flow (Officer confirm → Reviewer
// approve/release → Archive) stays identical everywhere. Rendered as icon
// buttons with tooltips to keep the actions column compact.
export function ReportActions({
  report,
  onChanged,
  onError,
  size = "sm",
}: {
  report: Report;
  onChanged: () => void;
  onError: (message: string) => void;
  size?: "sm" | "default";
}) {
  const t = useTranslations("app.reports");
  // The exported document follows the language the user is reading the app
  // in, so a report opened in Arabic downloads in Arabic.
  const locale = useLocale() as "en" | "ar";
  const canWrite = usePermission("reportsDashboards", "write");
  const canApprove = usePermission("reportsDashboards", "approve");
  const canExport = usePermission("reportsDashboards", "export");
  const [dialogMode, setDialogMode] = useState<"approve" | "reject" | null>(null);

  const isDraft = report.status === "draft";
  // Client-confirmed (Aug 13): "submitted" is its own status now (see
  // reports.types.ts) — replaces the old isConfirmed (officerConfirmedAt !==
  // null) check, which only ever tracked in step with status anyway.
  const isSubmitted = report.status === "submitted";
  const isReleased = report.status === "released";
  const exportable = EXPORTABLE_STATUSES.includes(report.status);
  const iconSize = size === "default" ? "icon" : "icon-sm";

  async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
    onError("");
    try {
      await action();
      onChanged();
      return true;
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t(fallback));
      return false;
    }
  }

  // Notes mandatory on both approve and reject (RIO-FR-007 clarification:
  // extends to all four report categories, not just the NCNP Compiled
  // Report) — same shared dialog the NCNP Report Review flow uses.
  async function handleDialogConfirm(notes: string) {
    const succeeded =
      dialogMode === "approve"
        ? await run(() => reportsService.approve(report.id, notes), "actionError")
        : dialogMode === "reject"
          ? await run(() => reportsService.reject(report.id, notes), "actionError")
          : false;
    if (succeeded) setDialogMode(null);
  }

  return (
    <TooltipProvider delayDuration={200}>
      {canWrite && isDraft ? (
        <IconAction
          icon={CheckCircle2}
          label={t("tooltip.confirm")}
          iconSize={iconSize}
          onClick={() => run(() => reportsService.confirm(report.id), "actionError")}
        />
      ) : null}

      {canApprove && isSubmitted ? (
        <IconAction
          icon={ShieldCheck}
          label={t("tooltip.approve")}
          iconSize={iconSize}
          onClick={() => setDialogMode("approve")}
        />
      ) : null}

      {canApprove && isSubmitted ? (
        <IconAction
          icon={XCircle}
          label={t("tooltip.reject")}
          variant="ghost"
          className="text-destructive hover:text-destructive"
          iconSize={iconSize}
          onClick={() => setDialogMode("reject")}
        />
      ) : null}

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

      {canApprove && isReleased ? (
        <IconAction
          icon={Archive}
          label={t("tooltip.archive")}
          iconSize={iconSize}
          onClick={() => run(() => reportsService.archive(report.id), "actionError")}
        />
      ) : null}

      {canExport && exportable && report.exportFormats.includes("pdf") ? (
        <IconAction
          icon={FileText}
          label={t("tooltip.exportPdf")}
          iconSize={iconSize}
          // Red = PDF, green = Excel (see the Excel export below) — same
          // shorthand every file picker/OS uses, so the two export actions
          // read as distinct at a glance instead of two near-identical
          // gray document glyphs.
          className="text-destructive hover:text-destructive"
          onClick={() =>
            run(
              () => reportsService.download(report.id, "pdf", locale),
              "detail.exportError",
            )
          }
        />
      ) : null}

      {canExport && exportable && report.exportFormats.includes("excel") ? (
        <IconAction
          icon={FileSpreadsheet}
          label={t("tooltip.exportExcel")}
          iconSize={iconSize}
          className="text-success hover:text-success"
          onClick={() =>
            run(
              () => reportsService.download(report.id, "excel", locale),
              "detail.exportError",
            )
          }
        />
      ) : null}
    </TooltipProvider>
  );
}
