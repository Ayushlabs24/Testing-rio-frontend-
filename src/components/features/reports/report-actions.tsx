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
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const canWrite = usePermission("reportsDashboards", "write");
  const canApprove = usePermission("reportsDashboards", "approve");
  const canExport = usePermission("reportsDashboards", "export");

  const isDraft = report.status === "draft";
  const isReleased = report.status === "released";
  const isConfirmed = report.officerConfirmedAt !== null;
  const exportable = EXPORTABLE_STATUSES.includes(report.status);
  const iconSize = size === "default" ? "icon" : "icon-sm";

  async function run(action: () => Promise<unknown>, fallback: string) {
    onError("");
    try {
      await action();
      onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t(fallback));
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      {canWrite && isDraft && !isConfirmed ? (
        <IconAction
          icon={CheckCircle2}
          label={t("tooltip.confirm")}
          iconSize={iconSize}
          onClick={() => run(() => reportsService.confirm(report.id), "actionError")}
        />
      ) : null}

      {canApprove && isDraft && isConfirmed ? (
        <IconAction
          icon={ShieldCheck}
          label={t("tooltip.approve")}
          iconSize={iconSize}
          onClick={() => run(() => reportsService.approve(report.id), "actionError")}
        />
      ) : null}

      {canApprove && isDraft ? (
        <IconAction
          icon={XCircle}
          label={t("tooltip.reject")}
          variant="ghost"
          className="text-destructive hover:text-destructive"
          iconSize={iconSize}
          onClick={() => run(() => reportsService.reject(report.id), "actionError")}
        />
      ) : null}

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
          onClick={() =>
            run(() => reportsService.download(report.id, "pdf"), "detail.exportError")
          }
        />
      ) : null}

      {canExport && exportable && report.exportFormats.includes("excel") ? (
        <IconAction
          icon={FileSpreadsheet}
          label={t("tooltip.exportExcel")}
          iconSize={iconSize}
          onClick={() =>
            run(() => reportsService.download(report.id, "excel"), "detail.exportError")
          }
        />
      ) : null}
    </TooltipProvider>
  );
}
