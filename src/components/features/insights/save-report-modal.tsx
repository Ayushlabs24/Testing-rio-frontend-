"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Save, Eye, Loader2, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { prioritySummaryService } from "@/services/reports/priority-summary.service";

export function SaveReportModal({
  open,
  onOpenChange,
  summaryId,
  studyId,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summaryId: string;
  studyId: string;
  scope: string;
}) {
  const t = useTranslations("PriorityDashboard.saveModal");
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSaveAndOpen = async () => {
    try {
      setSaving(true);
      const report = await prioritySummaryService.saveReportFromSummary(summaryId);
      onOpenChange(false);
      if (report && (report as Record<string, unknown>).id) {
        router.push(`/reports/${(report as Record<string, unknown>).id}`);
      } else {
        router.push(`/reports/${studyId}?scope=${scope}`);
      }
    } catch (err: unknown) {
      console.error(err);
      router.push(`/reports/${studyId}?scope=${scope}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewOnly = () => {
    onOpenChange(false);
    router.push(`/reports/${studyId}?scope=${scope}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Save className="text-primary size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("description", { scope })}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border-border my-2 space-y-2 rounded-lg border p-4 py-3 text-xs">
          <div className="text-foreground flex items-center gap-2 font-semibold">
            <CheckCircle2 className="text-success size-4" />
            {t("includedBox")}
          </div>
          <p className="text-muted-foreground text-[11px]">{t("includedDesc")}</p>
        </div>

        <DialogFooter className="flex flex-col items-center justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreviewOnly}
            disabled={saving}
            className="w-full gap-1.5 text-xs sm:w-auto"
          >
            <Eye className="size-3.5" />
            {t("previewOnly")}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveAndOpen}
            disabled={saving}
            className="w-full gap-1.5 text-xs sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("saving")}
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                {t("saveAndOpen")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
