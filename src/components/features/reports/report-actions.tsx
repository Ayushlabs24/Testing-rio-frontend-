"use client";

import { Archive, CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { reportsService } from "@/services/reports/reports.service";
import { EXPORTABLE_STATUSES, type Report } from "@/services/reports/reports.types";

// Lifecycle + export actions for a single report, shared by the list rows and
// the detail header so the two-step approval flow (Officer confirm → Reviewer
// approve/release → Archive) stays identical everywhere.
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
    <>
      {canWrite && isDraft && !isConfirmed ? (
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          onClick={() => run(() => reportsService.confirm(report.id), "actionError")}
        >
          <CheckCircle2 className="size-3.5" />
          {t("confirm")}
        </Button>
      ) : null}

      {canApprove && isDraft && isConfirmed ? (
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          onClick={() => run(() => reportsService.approve(report.id), "actionError")}
        >
          <ShieldCheck className="size-3.5" />
          {t("approve")}
        </Button>
      ) : null}

      {canApprove && isDraft ? (
        <Button
          size={size}
          variant="ghost"
          className="text-destructive gap-1.5"
          onClick={() => run(() => reportsService.reject(report.id), "actionError")}
        >
          <XCircle className="size-3.5" />
          {t("reject")}
        </Button>
      ) : null}

      {canApprove && isReleased ? (
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          onClick={() => run(() => reportsService.archive(report.id), "actionError")}
        >
          <Archive className="size-3.5" />
          {t("archive")}
        </Button>
      ) : null}

      {canExport && exportable && report.exportFormats.includes("pdf") ? (
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          onClick={() =>
            run(() => reportsService.download(report.id, "pdf"), "detail.exportError")
          }
        >
          <Download className="size-3.5" />
          {t("exportPdf")}
        </Button>
      ) : null}

      {canExport && exportable && report.exportFormats.includes("excel") ? (
        <Button
          size={size}
          variant="outline"
          className="gap-1.5"
          onClick={() =>
            run(() => reportsService.download(report.id, "excel"), "detail.exportError")
          }
        >
          <Download className="size-3.5" />
          {t("exportExcel")}
        </Button>
      ) : null}
    </>
  );
}
