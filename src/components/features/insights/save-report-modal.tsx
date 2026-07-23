"use client";

import { useState } from "react";
import { FileText, Save, Eye, Loader2, CheckCircle2 } from "lucide-react";
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
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSaveAndOpen = async () => {
    try {
      setSaving(true);
      const report = await prioritySummaryService.saveReportFromSummary(summaryId);
      onOpenChange(false);
      if (report && report.id) {
        router.push(`/reports/${report.id}`);
      } else {
        router.push(`/reports/${studyId}?scope=${scope}`);
      }
    } catch (err: any) {
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
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Save className="size-5 text-primary" />
            Save Confirmed Report to Repository?
          </DialogTitle>
          <DialogDescription className="text-xs">
            Would you like to save this confirmed <strong className="text-foreground">{scope} REPORT</strong> to the organization report repository for permanent archiving and team sharing?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 border border-border p-4 rounded-lg text-xs space-y-2 py-3 my-2">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <CheckCircle2 className="size-4 text-success" />
            Officer Confirmed Summary Included
          </div>
          <p className="text-muted-foreground text-[11px]">
            Saving will archive the frozen data snapshot, evidence list, and confirmed narrative under your Organization Reports dashboard.
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreviewOnly}
            disabled={saving}
            className="w-full sm:w-auto gap-1.5 text-xs"
          >
            <Eye className="size-3.5" />
            Preview Only (Do Not Save)
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSaveAndOpen}
            disabled={saving}
            className="w-full sm:w-auto gap-1.5 text-xs"
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving Report...
              </>
            ) : (
              <>
                <Save className="size-3.5" />
                Save & Open Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
